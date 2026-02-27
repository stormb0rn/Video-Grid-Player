import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// --- Test Configuration ---
const BASE_URL = 'http://localhost:8000';
// NOTE: In a real-world scenario, use environment variables for Supabase credentials.
// For this self-contained test, we read them from the project's config file.
const configPath = path.resolve(process.cwd(), 'public/config.js');
const configContent = fs.readFileSync(configPath, 'utf8');
const SUPABASE_CONFIG = {};
// A simple parser to extract config from the JS file
configContent.replace(/url: '([^']*)'/, (_, url) => SUPABASE_CONFIG.url = url);
configContent.replace(/anonKey: '([^']*)'/, (_, anonKey) => SUPABASE_CONFIG.anonKey = anonKey);
configContent.replace(/storageBucket: '([^']*)'/, (_, bucket) => SUPABASE_CONFIG.storageBucket = bucket);

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
const getUniqueName = () => `E2E-Player-Test-${Date.now()}`;


test.describe('Player Page Functionality', () => {
    let testDataset;

    // Create a temporary dataset and a video record before all tests run
    test.beforeAll(async () => {
        const datasetName = getUniqueName();
        // 1. Create dataset
        const { data, error } = await supabase.from('datasets').insert({ name: datasetName }).select().single();
        if (error) throw new Error(`Failed to create dataset for testing: ${error.message}`);
        testDataset = data;

        // 2. Add a dummy video record (no file upload needed, just a DB entry with a placeholder URL)
        await supabase.from('videos').insert({
            dataset_id: testDataset.id,
            file_name: 'test-video.mp4',
            public_url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4', // A real, short mp4 url
            storage_path: `${testDataset.id}/test-video.mp4`
        });
    });

    // Clean up the temporary data after all tests have run
    test.afterAll(async () => {
        if (testDataset) {
            await supabase.from('datasets').delete().eq('id', testDataset.id);
        }
    });

    // --- Tests ---
    test('should load videos and display correct titles', async ({ page }) => {
        await page.goto(`${BASE_URL}/player.html?dataset=${testDataset.id}`);
        
        await expect(page.locator('#playerTitle')).toHaveText(testDataset.name);
        await expect(page.locator('#playerSubtitle')).toContainText('1 videos');
        await expect(page.locator('.video-item-container')).toHaveCount(1);
    });

    test('should adjust videos per row with slider', async ({ page }) => {
        await page.goto(`${BASE_URL}/player.html?dataset=${testDataset.id}`);
        const videoGrid = page.locator('#videoGrid');

        // Check default
        let gridStyle = await videoGrid.getAttribute('style');
        expect(gridStyle).toBeNull(); // Or match initial state if any

        // Change slider
        await page.locator('#videosPerRow').fill('8');

        // Check updated style
        gridStyle = await videoGrid.getAttribute('style');
        expect(gridStyle).toContain('--videos-per-row: 8');
        await expect(page.locator('#videosPerRowValue')).toHaveText('8');
    });

    test('should handle video selection correctly', async ({ page }) => {
        await page.goto(`${BASE_URL}/player.html?dataset=${testDataset.id}`);
        const videoContainer = page.locator('.video-item-container').first();
        const selectedCount = page.locator('#selectedCount');

        // 1. Select a video
        await videoContainer.click();
        await expect(videoContainer).toHaveClass(/selected/);
        await expect(selectedCount).toHaveText('1');
        
        // 2. Deselect it
        await videoContainer.click();
        await expect(videoContainer).not.toHaveClass(/selected/);
        await expect(selectedCount).toHaveText('0');

        // 3. Select All
        await page.locator('#selectAllBtn').click();
        await expect(videoContainer).toHaveClass(/selected/);
        await expect(selectedCount).toHaveText('1');

        // 4. Deselect All
        await page.locator('#deselectAllBtn').click();
        await expect(videoContainer).not.toHaveClass(/selected/);
        await expect(selectedCount).toHaveText('0');
    });
    
    test('should change playback speed for video', async ({ page }) => {
        await page.goto(`${BASE_URL}/player.html?dataset=${testDataset.id}`);
        const videoElement = page.locator('video').first();
        
        // Check default speed
        expect(await videoElement.evaluate(v => v.playbackRate)).toBe(1);

        // Click 2x speed
        await page.locator('.playback-speed-btn[data-speed="2"]').click();

        // Verify speed changed
        expect(await videoElement.evaluate(v => v.playbackRate)).toBe(2);
    });
}); 