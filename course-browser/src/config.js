// Configuration
export const config = {
    api: {
        baseUrl: "http://127.0.0.1:8000",
        // baseUrl: "https://sisukas-filters-api-969370446235.europe-north1.run.app",
        timeout: 30000, // 30 seconds
    },
    ui: {
        notificationDuration: {
            success: 1000,
            error: 2000,
        }
    }
};