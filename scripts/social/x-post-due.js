'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const QUEUE_PATH = path.join(ROOT_DIR, 'data', 'social', 'x-post-queue.json');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const DEFAULT_API_BASE_URL = 'https://api.x.com';
const MAX_POST_CHARS = 280;

const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');
const isValidateOnly = args.has('--validate-only');
const postAllDue = args.has('--all');

loadEnvFile(ENV_PATH);

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const queue = readQueue();
  const errors = validateQueue(queue);

  if (errors.length > 0) {
    console.error('X post queue validation failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  if (isValidateOnly) {
    console.log(`Validated ${queue.posts.length} queued posts for ${queue.account}.`);
    return;
  }

  const now = getNow();
  const duePosts = queue.posts
    .filter((post) => post.status === 'approved')
    .filter((post) => !post.postedAt && !post.postId)
    .filter((post) => new Date(post.scheduledAt).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  if (duePosts.length === 0) {
    const nextPost = queue.posts
      .filter((post) => post.status === 'approved')
      .filter((post) => !post.postedAt && !post.postId)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0];

    console.log('No approved X posts are due.');
    if (nextPost) {
      console.log(`Next: ${nextPost.id} at ${nextPost.scheduledAt}`);
    }
    return;
  }

  const postsToSend = postAllDue ? duePosts : [duePosts[0]];
  if (isDryRun) {
    for (const post of postsToSend) {
      printDryRun(post);
    }
    return;
  }

  const token = process.env.X_USER_ACCESS_TOKEN;
  if (!token) {
    throw new Error('X_USER_ACCESS_TOKEN is missing. Add it to .env before posting.');
  }

  for (const post of postsToSend) {
    const result = await publishPost(post, token);
    post.status = 'posted';
    post.postedAt = new Date().toISOString();
    post.postId = result.id;
    post.xResponseText = result.text;
    console.log(`Posted ${post.id}: ${result.id}`);
  }

  writeQueue(queue);
}

function readQueue() {
  return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
}

function writeQueue(queue) {
  fs.writeFileSync(QUEUE_PATH, `${JSON.stringify(queue, null, 2)}\n`);
}

function validateQueue(queue) {
  const errors = [];
  const ids = new Set();
  const normalizedTexts = new Map();

  if (!queue || !Array.isArray(queue.posts)) {
    return ['data/social/x-post-queue.json must contain a posts array.'];
  }

  for (const post of queue.posts) {
    if (!post.id) {
      errors.push('A post is missing id.');
      continue;
    }

    if (ids.has(post.id)) {
      errors.push(`${post.id}: duplicate id.`);
    }
    ids.add(post.id);

    if (!['draft', 'approved', 'posted', 'skipped'].includes(post.status)) {
      errors.push(`${post.id}: status must be draft, approved, posted, or skipped.`);
    }

    if (!post.scheduledAt || Number.isNaN(new Date(post.scheduledAt).getTime())) {
      errors.push(`${post.id}: scheduledAt must be a valid ISO timestamp.`);
    }

    if (!post.text || typeof post.text !== 'string') {
      errors.push(`${post.id}: text is required.`);
    } else {
      const length = Array.from(post.text).length;
      if (length > MAX_POST_CHARS) {
        errors.push(`${post.id}: text is ${length} characters, above ${MAX_POST_CHARS}.`);
      }

      const normalizedText = normalizeText(post.text);
      if (normalizedTexts.has(normalizedText)) {
        errors.push(`${post.id}: text duplicates ${normalizedTexts.get(normalizedText)}.`);
      }
      normalizedTexts.set(normalizedText, post.id);
    }

    if (post.media) {
      const mediaPath = path.join(ROOT_DIR, post.media.path || '');
      if (!post.media.path) {
        errors.push(`${post.id}: media.path is required when media is set.`);
      } else if (!fs.existsSync(mediaPath)) {
        errors.push(`${post.id}: media file does not exist: ${post.media.path}`);
      }

      if (!post.media.alt) {
        errors.push(`${post.id}: media.alt is recommended for screenshots and cards.`);
      }
    }
  }

  return errors;
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function getNow() {
  const nowArg = process.argv.find((arg) => arg.startsWith('--now='));
  if (!nowArg) {
    return new Date();
  }

  const value = nowArg.slice('--now='.length);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --now value: ${value}`);
  }
  return parsed;
}

function printDryRun(post) {
  console.log('---');
  console.log(`id: ${post.id}`);
  console.log(`scheduledAt: ${post.scheduledAt}`);
  console.log(`category: ${post.category}`);
  if (post.media) {
    console.log(`media: ${post.media.path}`);
  }
  console.log(post.text);
}

async function publishPost(post, token) {
  const body = { text: post.text };

  if (post.media) {
    const mediaId = await uploadMedia(post.media, token);
    body.media = { media_ids: [mediaId] };
  }

  const response = await xFetch('/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.data || !response.data.id) {
    throw new Error(`Unexpected create post response for ${post.id}: ${JSON.stringify(response)}`);
  }

  return response.data;
}

async function uploadMedia(media, token) {
  const mediaPath = path.join(ROOT_DIR, media.path);
  const mediaBuffer = fs.readFileSync(mediaPath);
  const mediaType = getMediaType(mediaPath);
  const response = await xFetch('/2/media/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      media: mediaBuffer.toString('base64'),
      media_category: 'tweet_image',
      media_type: mediaType,
      shared: false
    })
  });

  const mediaId = response.data && response.data.id;
  if (!mediaId) {
    throw new Error(`Unexpected media upload response for ${media.path}: ${JSON.stringify(response)}`);
  }

  await waitForMediaProcessing(mediaId, token, response.data.processing_info);
  return mediaId;
}

async function waitForMediaProcessing(mediaId, token, processingInfo) {
  let info = processingInfo;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (!info || info.state === 'succeeded') {
      return;
    }

    if (info.state === 'failed') {
      throw new Error(`Media processing failed for ${mediaId}: ${JSON.stringify(info)}`);
    }

    const waitSeconds = Math.max(1, Math.min(Number(info.check_after_secs) || 2, 10));
    await sleep(waitSeconds * 1000);

    const status = await xFetch(`/2/media/upload?media_id=${encodeURIComponent(mediaId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    info = status.data && status.data.processing_info;
  }

  throw new Error(`Media processing did not finish for ${mediaId}.`);
}

async function xFetch(endpoint, options) {
  const baseUrl = process.env.X_API_BASE_URL || DEFAULT_API_BASE_URL;
  const response = await fetch(`${baseUrl}${endpoint}`, options);
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`X API ${response.status} ${response.statusText}: ${JSON.stringify(json)}`);
  }

  return json;
}

function getMediaType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.png') {
    return 'image/png';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  throw new Error(`Unsupported media type: ${filePath}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = stripQuotes(value);
    }
  }
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
