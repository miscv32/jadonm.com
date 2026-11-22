(() => {
    const controls = document.querySelector("[data-j-lens]");
    const frame = document.getElementById("j-lens-figure");
    const buttons = controls.querySelectorAll("button[data-slide]");
    const slideshow = controls.parentElement.querySelector(".j-lens-steps");
    const [previous, next] = slideshow.querySelectorAll("button");
    const status = slideshow.querySelector("[role=status]");
    const steps = ["average-1", "average-2", "average-3", "average-4", "average"];
    let step = 0;

    function showSlide(fragment, title) {
        const slide = new URL(frame.src);
        if (slide.hash !== `#${fragment}`) {
            slide.hash = fragment;
            frame.src = slide.href;
        }
        frame.title = `J-lens diagram: ${title}`;
    }

    function showStep() {
        const isMean = step === steps.length - 1;
        const title = isMean ? "Mean response" : `Context ${step + 1}`;
        showSlide(steps[step], `Average effects, ${title}`);
        previous.disabled = step === 0;
        next.disabled = isMean;
        status.textContent = `${step + 1} / ${steps.length}`;
    }

    for (const button of buttons) {
        button.addEventListener("click", () => {
            for (const pane of buttons) pane.setAttribute("aria-pressed", String(pane === button));
            slideshow.hidden = button.dataset.slide !== "average";
            if (slideshow.hidden) {
                showSlide(button.dataset.slide, button.textContent);
            } else {
                showStep();
            }
        });
    }

    for (const button of [previous, next]) {
        button.addEventListener("click", () => {
            step += Number(button.dataset.direction);
            showStep();
        });
    }
    showStep();
    slideshow.hidden = false;
    controls.hidden = false;
})();
