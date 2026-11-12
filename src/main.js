import "./style.css";
import "./zforce-ball.js";

const stage = document.querySelector("#ball-stage");
const optionButtons = [...document.querySelectorAll(".ball-option")];

optionButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    optionButtons.forEach((option, optionIndex) => {
      const selected = optionIndex === index;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    stage.__zforce?.select(index);
  });
});

function showBallStage() {
  stage.__zforce.ready.then(() => stage.classList.add("is-ready"));
}

if (stage.__zforce) {
  showBallStage();
} else {
  document.addEventListener("DOMContentLoaded", showBallStage, { once: true });
}
