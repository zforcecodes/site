import "./style.css";
import "./zforce-ball.js";

const stage = document.querySelector("#ball-stage");
const optionButtons = [...document.querySelectorAll(".ball-option")];
const selectedDetail = document.querySelector("#selected-detail");
const productEnquiry = document.querySelector("#product-enquiry");

optionButtons.forEach((button, index) => {
  button.style.setProperty("--option-color", button.dataset.color);
  button.addEventListener("click", () => {
    optionButtons.forEach((option, optionIndex) => {
      const selected = optionIndex === index;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    const name = button.querySelector(".option-name").textContent.trim();
    selectedDetail.textContent = button.dataset.detail;
    const subject = `ZFORCE ${name} cricket ball enquiry`;
    const body = [
      `Hello ZFORCE, I'm interested in the ${name.toLowerCase()} cricket ball.`,
      "Please share the current price, availability, and delivery details.",
    ].join("\n\n");
    productEnquiry.href = `mailto:zforcesportz@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    stage.__zforce?.select(index);
  });
});

document.querySelector("#contact-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const subject = `ZFORCE gear enquiry from ${formData.get("name")}`;
  const body = [
    `Name: ${formData.get("name")}`,
    `Email: ${formData.get("email")}`,
    "",
    String(formData.get("message")),
  ].join("\n");
  window.location.href = `mailto:zforcesportz@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

function showBallStage() {
  stage.__zforce.ready.then(() => stage.classList.add("is-ready"));
}

if (stage.__zforce) {
  showBallStage();
} else {
  document.addEventListener("DOMContentLoaded", showBallStage, { once: true });
}
