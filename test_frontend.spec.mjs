import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000'; // Assuming a local dev server will be running

// Helper function to create a unique dataset name
const getUniqueDatasetName = () => `Test-Dataset-${Date.now()}`;

test.describe('Dataset Management Page', () => {

    let page;
    let uniqueDatasetName;

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
        uniqueDatasetName = getUniqueDatasetName();
    });

    test.afterAll(async () => {
        await page.close();
    });

    test('should load the dataset management page correctly', async () => {
        await page.goto(`${BASE_URL}/datasets.html`);
        await expect(page).toHaveTitle(/数据集管理/);
        await expect(page.locator('h2').first()).toHaveText(/数据集/);
    });

    test('should allow creating a new dataset', async () => {
        // Click the "add" button
        await page.locator('#addDatasetBtn').click();
        
        // Check if the modal appears
        await expect(page.locator('#createDatasetModal')).toBeVisible();

        // Fill in the dataset name
        await page.locator('#newDatasetName').fill(uniqueDatasetName);

        // Click the "create" button
        await page.locator('#confirmCreateBtn').click();
        
        // Check if the modal disappears
        await expect(page.locator('#createDatasetModal')).toBeHidden();

        // Verify the new dataset appears in the list (we'll look for it)
        // This uses a text selector which is robust.
        await expect(page.locator(`li:has-text("${uniqueDatasetName}")`)).toBeVisible({ timeout: 10000 });
    });

    test('should allow deleting the created dataset', async () => {
        // 1. Select the dataset first
        await page.locator(`li:has-text("${uniqueDatasetName}")`).click();
        
        // 2. Wait for the right panel to update and show the name
        await expect(page.locator('#currentDatasetName')).toHaveText(uniqueDatasetName);
        
        // 3. Set up a handler for the confirmation dialog
        page.on('dialog', dialog => dialog.accept());
        
        // 4. Click the delete button
        await page.locator('#deleteDatasetBtn').click();

        // 5. Verify the dataset is removed from the list
        await expect(page.locator(`li:has-text("${uniqueDatasetName}")`)).toBeHidden({ timeout: 10000 });
    });

    test('should allow renaming the created dataset', async () => {
        // 1. 选中刚创建的数据集
        await page.locator(`li:has-text("${uniqueDatasetName}")`).click();
        await expect(page.locator('#currentDatasetName')).toHaveText(uniqueDatasetName);
        // 2. 点击重命名按钮
        await page.locator('#renameDatasetBtn').click();
        await expect(page.locator('#renameDatasetModal')).toBeVisible();
        // 3. 填写新名称并确认
        const newName = uniqueDatasetName + '-Renamed';
        await page.locator('#renameDatasetName').fill(newName);
        await page.locator('#confirmRenameBtn').click();
        // 4. 检查弹窗关闭，名称已更新
        await expect(page.locator('#renameDatasetModal')).toBeHidden();
        await expect(page.locator('#currentDatasetName')).toHaveText(newName, { timeout: 5000 });
        // 5. 检查左侧列表也已更新
        await expect(page.locator(`li:has-text("${newName}")`)).toBeVisible({ timeout: 10000 });
    });
}); 