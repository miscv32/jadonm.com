if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    var element = document.body;
    element.classList.toggle("dark-mode");
}

function lightDark() {
    var element = document.body;
    element.classList.toggle("dark-mode");
    for (let i=0; element.children.length; i++) {
        element.children[i].classList.toggle("dark-mode")
    }
  }