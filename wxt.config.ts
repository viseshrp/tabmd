import { defineConfig } from "wxt";

const manifestVersion =
	process.env.RELEASE_VERSION ?? process.env.npm_package_version ?? "1.0.0";
const oauthClientId =
	"316914322209-l8uh5oeed3haj3khhtvs93tqvn9qmrj7.apps.googleusercontent.com";
const extensionKey =
	"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA+Uz8HlKJsZ6KSvl6pfVu7rhXWtoRww+gdeEv78jNuEkYuBuZ83n4DzXg/tZqoE5NtFfm/kLkThVM3D3+JK41yDMAbtQA7zoGSbzxhb1UakI7Rt1t8hTVYl2a+hJ0wfWRVUgckkYj5xostHa+F6fkJ3d5F6v7ZXISSa0EQstgLNwiQyLRp0gc0Rq/ksPyaHEVulg9OIVfGhY0+EBzVnyatq3H6d1/dGd6Fgdli5FmbsVzmsPPO0sds/ozyYo0+MK71yP38cgBq/70CBKDzobxYRl8Ikaaywzjl/7PZmtHjXQEeZSZJJ0WNGyyu5hUIgzXyNl8GXZCGE8P6llojhfO5QIDAQAB";

export default defineConfig({
	entrypointsDir: "entrypoints",
	outDirTemplate: "{{browser}}-mv{{manifestVersion}}{{modeSuffix}}",
	vite: () => ({
		build: {
			sourcemap: false,
		},
	}),
	manifest: {
		version: manifestVersion,
		name: "TabMD",
		description: "Markdown notes in every new tab.",
		homepage_url: "https://github.com/viseshrp/tabmd",
		permissions: ["storage", "unlimitedStorage", "identity"],
		host_permissions: ["https://www.googleapis.com/"],
		oauth2: {
			client_id: oauthClientId,
			scopes: ["https://www.googleapis.com/auth/drive.file"],
		},
		...(extensionKey ? { key: extensionKey } : {}),
		action: {
			default_popup: "popup/index.html",
			default_title: "TabMD",
			default_icon: {
				16: "icon/16.png",
				19: "icon/19.png",
				32: "icon/32.png",
				38: "icon/38.png",
				48: "icon/48.png",
				96: "icon/96.png",
				128: "icon/128.png",
			},
		},
		icons: {
			16: "icon/16.png",
			19: "icon/19.png",
			32: "icon/32.png",
			38: "icon/38.png",
			48: "icon/48.png",
			96: "icon/96.png",
			128: "icon/128.png",
		},
	},
});
