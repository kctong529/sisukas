export async function getYaml() {
    const yaml = await import('https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm');
    return yaml;
}