(() => {
    for (const toggle of document.querySelectorAll(".residual-stream-toggle:not([data-j-lens])")) {
        const [full, lens] = toggle.querySelectorAll("button");
        const frame = document.getElementById(full.getAttribute("aria-controls"));

        function updateFigure() {
            const view = lens.getAttribute("aria-pressed") === "true" ? "lens" : "full";
            frame.contentWindow.postMessage({ residualStreamView: view }, "*");
        }

        function selectView(useLens) {
            full.setAttribute("aria-pressed", String(!useLens));
            lens.setAttribute("aria-pressed", String(useLens));
            updateFigure();
        }

        full.addEventListener("click", () => selectView(false));
        lens.addEventListener("click", () => selectView(true));
        frame.addEventListener("load", updateFigure);
    }
})();
