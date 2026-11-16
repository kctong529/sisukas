// @vitest-environment jsdom
import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AccountSettings from "../../../src/components/auth/AccountSettings.svelte";

const auth = vi.hoisted(() => ({
    getConnectedMethods: vi.fn(),
    linkGoogle: vi.fn(),
    savePendingGoogleLink: vi.fn(),
    clearPendingGoogleLink: vi.fn(),
    googleLinkCallbackURL: vi.fn(() => "https://test.sisukas.eu/?account_link=google"),
    evaluateGoogleLinkReturn: vi.fn(),
}));

vi.mock("@modules/auth", () => auth);

type Component = ReturnType<typeof mount>;
const components: Component[] = [];

function render(linkReturn: { originalUserId: string | null; errorCode: string | null } | null = null) {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const onclose = vi.fn();
    components.push(mount(AccountSettings, {
        target,
        props: {
            email: "oauth-test@sisukas.eu",
            userId: "user-A",
            linkReturn,
            onclose,
        },
    }));
    flushSync();
    return { target, onclose };
}

function button(target: HTMLElement, label: string) {
    const found = [...target.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
    if (!found) throw new Error(`Missing button ${label}`);
    return found;
}

beforeEach(() => {
    vi.clearAllMocks();
    auth.getConnectedMethods.mockResolvedValue({ googleConnected: false });
    auth.linkGoogle.mockResolvedValue({ error: null });
    // jsdom does not implement native modal behavior.
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
    };
});

afterEach(async () => {
    for (const component of components.splice(0)) await unmount(component);
    document.body.replaceChildren();
});

describe("Account settings dialog", () => {
    it("displays the email, available magic link and disconnected Google", async () => {
        const { target } = render();
        await vi.waitFor(() => expect(target.textContent).toContain("Not connected"));
        expect(target.textContent).toContain("oauth-test@sisukas.eu");
        expect(target.textContent).toContain("Email magic link");
        expect(button(target, "Connect Google").disabled).toBe(false);
        const logo = target.querySelector<HTMLImageElement>(".google-mark");
        expect(logo?.getAttribute("src")).toBe("/images/google-g.png");
        expect(logo?.getAttribute("alt")).toBe("");
        expect(target.querySelector('img[src*="firebasejs"]')).toBeNull();
    });

    it("shows a connected Google identity without a Connect action", async () => {
        auth.getConnectedMethods.mockResolvedValue({ googleConnected: true });
        const { target } = render();
        await vi.waitFor(() => expect(target.textContent).toContain("Connected to this account"));
        expect([...target.querySelectorAll("button")].some((b) => b.textContent?.includes("Connect Google"))).toBe(false);
        expect(target.querySelector(".google-mark")).not.toBeNull();
    });

    it("reports provider retrieval failures and retries", async () => {
        auth.getConnectedMethods.mockRejectedValueOnce(new Error("network"));
        const { target } = render();
        await vi.waitFor(() => expect(target.querySelector('[role="alert"]')?.textContent).toContain("Could not load"));
        button(target, "Retry").click();
        await vi.waitFor(() => expect(target.textContent).toContain("Not connected"));
        expect(auth.getConnectedMethods).toHaveBeenCalledTimes(2);
    });

    it("announces linking failures using alert semantics", async () => {
        auth.evaluateGoogleLinkReturn.mockReturnValue({ success: false, message: "Google account email differs" });
        const { target } = render({ originalUserId: "user-A", errorCode: "email_does_not_match" });
        await vi.waitFor(() => expect(target.querySelector('[role="alert"]')?.textContent).toContain("email differs"));
        expect(target.querySelector(".link-error")).not.toBeNull();
    });

    it("announces confirmed links as status, not errors", async () => {
        auth.evaluateGoogleLinkReturn.mockReturnValue({ success: true, message: "Google connected" });
        auth.getConnectedMethods.mockResolvedValue({ googleConnected: true });
        const { target } = render({ originalUserId: "user-A", errorCode: null });
        await vi.waitFor(() => expect(target.querySelector('.link-success[role="status"]')?.textContent).toContain("Google connected"));
    });

    it("closes through the close button and notifies the parent", () => {
        const { target, onclose } = render();
        (target.querySelector('button[aria-label="Close account settings"]') as HTMLButtonElement).click();
        flushSync();
        expect(onclose).toHaveBeenCalledOnce();
    });
});

// Provider initiation errors must remain visible as accessible failure feedback.
describe("Connect Google initiation", () => {
    it("announces a failed linking initiation and allows retry", async () => {
        auth.linkGoogle.mockResolvedValue({ error: { message: "Not allowed" } });
        const { target } = render();
        await vi.waitFor(() => expect(target.textContent).toContain("Not connected"));
        button(target, "Connect Google").click();
        await vi.waitFor(() => expect(target.querySelector('.link-error[role="alert"]')?.textContent).toContain("Could not start Google linking"));
        expect(auth.clearPendingGoogleLink).toHaveBeenCalled();
        expect(button(target, "Connect Google").disabled).toBe(false);
    });
});
