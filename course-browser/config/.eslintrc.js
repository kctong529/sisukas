export default [
    {
        linterOptions: {
            noInlineConfig: true,
            reportUnusedDisableDirectives: "warn"
        }
    },
    {
        rules: {
            semi: "error",
            "prefer-const": "error"
        }
    },
    {
        // Note: there should be no other properties in this object
        ignores: ["coverage/*"]
    }
];