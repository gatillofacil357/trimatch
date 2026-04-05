const Jimp = require('jimp');
const fs = require('fs');

const SRC_IMAGES = {
    fade: 'C:\\Users\\marco\\.gemini\\antigravity\\brain\\2e5db51f-4d4f-4907-820a-2ddd9aaeae56\\hair_fade_solid_1775347850744.png',
    buzz: 'C:\\Users\\marco\\.gemini\\antigravity\\brain\\2e5db51f-4d4f-4907-820a-2ddd9aaeae56\\hair_buzz_solid_1775347862523.png',
    undercut: 'C:\\Users\\marco\\.gemini\\antigravity\\brain\\2e5db51f-4d4f-4907-820a-2ddd9aaeae56\\hair_undercut_solid_1775347875697.png'
};

const DEST_DIR = 'C:\\Users\\marco\\.gemini\\antigravity\\scratch\\trimatch\\public\\assets\\hair';

async function processImages() {
    for (const [style, srcPath] of Object.entries(SRC_IMAGES)) {
        if (!fs.existsSync(srcPath)) {
            console.warn(`File not found: ${srcPath}`);
            continue; // Skip if file doesn't exist
        }
        
        console.log(`Processing ${style}...`);
        const img = await Jimp.read(srcPath);
        
        // Convert pure white to transparent + soft edges
        // Darkest hair colors are protected, white is erased
        img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            
            // Calculate lightness (0 to 255)
            const lightness = (r + g + b) / 3;
            
            // If it's mostly white, make it transparent
            if (lightness > 230) {
                this.bitmap.data[idx + 3] = 0; // Alpha 0
            } else if (lightness > 180) {
                // Soft transition for anti-aliasing (semi-transparent)
                const alpha = Math.floor(255 * ((230 - lightness) / 50));
                this.bitmap.data[idx + 3] = alpha;
            }
        });

        // Crop tight to reduce size and help validation logic find bounds
        img.autocrop({ cropOnlyFrames: false, tolerance: 0.1 });
        
        // Save as true transparent PNG in the public folder
        const outPath = `${DEST_DIR}\\${style}_front.png`;
        await img.writeAsync(outPath);
        console.log(`Saved transparent asset: ${outPath}`);
    }
}

processImages().catch(console.error);
