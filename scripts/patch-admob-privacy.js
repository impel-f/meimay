const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function patchFile(relativePath, patches) {
    const filePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing file: ${relativePath}`);
    }

    let source = fs.readFileSync(filePath, 'utf8');
    let updated = source;

    patches.forEach(({ label, before, after }) => {
        if (updated.includes(after)) return;
        if (!updated.includes(before)) {
            throw new Error(`Unable to apply ${label} patch to ${relativePath}`);
        }
        updated = updated.replace(before, after);
    });

    if (updated !== source) {
        fs.writeFileSync(filePath, updated);
        console.log(`Patched ${relativePath}`);
    }
}

patchFile('node_modules/@capacitor-community/admob/ios/Sources/AdMobPlugin/AdMobPlugin.swift', [
    {
        label: 'iOS publisher first-party ID',
        before: `    private func setRequestConfiguration(_ call: CAPPluginCall) {\n\n        if call.getBool("initializeForTesting") ?? false {`,
        after: `    private func setRequestConfiguration(_ call: CAPPluginCall) {\n        MobileAds.shared.requestConfiguration.setPublisherFirstPartyIDEnabled(\n            call.getBool("publisherFirstPartyIdEnabled") ?? true\n        )\n\n        if call.getBool("initializeForTesting") ?? false {`
    }
]);

patchFile('node_modules/@capacitor-community/admob/android/src/main/java/com/getcapacitor/community/admob/AdMob.java', [
    {
        label: 'Android publisher first-party ID',
        before: `    private void setRequestConfiguration(final PluginCall call) {\n        // Testing Devices`,
        after: `    private void setRequestConfiguration(final PluginCall call) {\n        final Boolean publisherFirstPartyIdEnabled = call.getBoolean("publisherFirstPartyIdEnabled");\n        if (publisherFirstPartyIdEnabled != null) {\n            MobileAds.putPublisherFirstPartyIdEnabled(publisherFirstPartyIdEnabled);\n        }\n\n        // Testing Devices`
    }
]);

patchFile('node_modules/@capacitor-community/admob/android/src/main/java/com/getcapacitor/community/admob/banner/BannerExecutor.java', [
    {
        label: 'Android banner root container',
        before: `import android.widget.RelativeLayout;\nimport androidx.annotation.NonNull;`,
        after: `import android.widget.FrameLayout;\nimport android.widget.RelativeLayout;\nimport androidx.annotation.NonNull;`
    },
    {
        label: 'Android banner content parent',
        before: `    public void initialize() {\n        mViewGroup = (ViewGroup) ((ViewGroup) activitySupplier.get().findViewById(android.R.id.content)).getChildAt(0);\n    }`,
        after: `    public void initialize() {\n        mViewGroup = activitySupplier.get().findViewById(android.R.id.content);\n    }`
    },
    {
        label: 'Android banner frame layout params',
        before: `            final CoordinatorLayout.LayoutParams mAdViewLayoutParams = new CoordinatorLayout.LayoutParams(\n                CoordinatorLayout.LayoutParams.WRAP_CONTENT,\n                CoordinatorLayout.LayoutParams.WRAP_CONTENT\n            );`,
        after: `            final FrameLayout.LayoutParams mAdViewLayoutParams = new FrameLayout.LayoutParams(\n                FrameLayout.LayoutParams.WRAP_CONTENT,\n                FrameLayout.LayoutParams.WRAP_CONTENT\n            );`
    }
]);

patchFile('node_modules/@capacitor-community/admob/dist/esm/definitions.d.ts', [
    {
        label: 'TypeScript publisher first-party ID option',
        before: `    maxAdContentRating?: MaxAdContentRating;\n}`,
        after: `    maxAdContentRating?: MaxAdContentRating;\n    /**\n     * Controls Google Mobile Ads Publisher first-party ID usage.\n     *\n     * @default true\n     */\n    publisherFirstPartyIdEnabled?: boolean;\n}`
    }
]);
