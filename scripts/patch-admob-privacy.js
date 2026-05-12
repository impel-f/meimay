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

patchFile('node_modules/@capacitor-community/admob/dist/esm/definitions.d.ts', [
    {
        label: 'TypeScript publisher first-party ID option',
        before: `    maxAdContentRating?: MaxAdContentRating;\n}`,
        after: `    maxAdContentRating?: MaxAdContentRating;\n    /**\n     * Controls Google Mobile Ads Publisher first-party ID usage.\n     *\n     * @default true\n     */\n    publisherFirstPartyIdEnabled?: boolean;\n}`
    }
]);
