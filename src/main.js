import * as THREE from "three";
import "./style.css";

const stage = document.querySelector("#ball-stage");
const ballLabel = document.querySelector("#ball-label");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
camera.position.set(0, 0, 6.8);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
stage.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xfff8ec, 0x4a4034, 2.15));
const keyLight = new THREE.DirectionalLight(0xfff5e6, 3.8);
keyLight.position.set(-3.2, 4.5, 5);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xff7959, 2.3);
rimLight.position.set(4, -1.5, -2);
scene.add(rimLight);

const ballGroup = new THREE.Group();
ballGroup.scale.setScalar(0.86);
scene.add(ballGroup);
const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.48, 96, 72),
  new THREE.MeshStandardMaterial({ color: "#b93329", roughness: 0.39, metalness: 0.02 }),
);
ballGroup.add(sphere);

const seamMaterial = new THREE.MeshStandardMaterial({
  color: "#f1d8b8",
  roughness: 0.72,
  metalness: 0,
});
const seamGroup = new THREE.Group();
ballGroup.add(seamGroup);

function createSeam() {
  seamGroup.clear();
  const radius = 1.496;
  const longitude = 0.15;
  for (const offset of [-0.037, 0.037]) {
    const points = [];
    for (let index = 0; index <= 180; index += 1) {
      const angle = -Math.PI * 0.48 + (index / 180) * Math.PI * 0.96;
      const latitude = angle + offset;
      points.push(
        new THREE.Vector3(
          radius * Math.cos(latitude) * Math.sin(longitude),
          radius * Math.sin(latitude),
          radius * Math.cos(latitude) * Math.cos(longitude),
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points);
    seamGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.019, 8, false), seamMaterial));

    for (let index = 12; index < 170; index += 7) {
      const point = curve.getPointAt(index / 180);
      const next = curve.getPointAt(Math.min(1, (index + 2.5) / 180));
      const stitch = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.012, 0.027, 3, 5),
        seamMaterial,
      );
      stitch.position.copy(point);
      stitch.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        next.sub(point).normalize(),
      );
      seamGroup.add(stitch);
    }
  }
}
createSeam();

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(1.65, 64),
  new THREE.MeshBasicMaterial({ color: 0x24231f, transparent: true, opacity: 0.1 }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(0.15, -1.65, 0);
shadow.scale.set(1.2, 0.55, 1);
scene.add(shadow);

const variants = {
  red: { name: "THE RED LEATHER", color: "#b93329", seam: "#f1d8b8", rim: "#ff7959" },
  white: { name: "THE WHITE LEATHER", color: "#e8e8dc", seam: "#9b8e79", rim: "#d8d1c2" },
  cork: { name: "THE CORK BALL", color: "#c49654", seam: "#694822", rim: "#e9c384" },
};

function setVariant(name) {
  const variant = variants[name] ? variants[name] : variants.red;
  sphere.material.color.set(variant.color);
  sphere.material.roughness = name === "cork" ? 0.85 : name === "white" ? 0.48 : 0.39;
  seamMaterial.color.set(variant.seam);
  rimLight.color.set(variant.rim);
  ballLabel.textContent = variant.name;
  document.querySelectorAll(".product-select").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.ball === name));
  });
  ballGroup.rotation.y += 0.7;
  if (reducedMotion) renderer.render(scene, camera);
}

for (const button of document.querySelectorAll(".product-select")) {
  button.addEventListener("click", () => {
    setVariant(button.dataset.ball);
    document.querySelector("#home").scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" });
  });
}

let pointerDown = false;
let lastPointerX = 0;
let lastPointerY = 0;
let dragVelocity = 0;
stage.addEventListener("pointerdown", (event) => {
  pointerDown = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener("pointermove", (event) => {
  if (!pointerDown) return;
  const deltaX = event.clientX - lastPointerX;
  const deltaY = event.clientY - lastPointerY;
  ballGroup.rotation.y += deltaX * 0.009;
  ballGroup.rotation.x = THREE.MathUtils.clamp(ballGroup.rotation.x + deltaY * 0.009, -0.75, 0.75);
  dragVelocity = deltaX * 0.0007;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
});
stage.addEventListener("pointerup", () => { pointerDown = false; });
stage.addEventListener("pointercancel", () => { pointerDown = false; });

function resize() {
  const { width, height } = stage.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.position.z = width < 620 ? 7.4 : 6.8;
  camera.updateProjectionMatrix();
  if (reducedMotion) renderer.render(scene, camera);
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(stage);
resize();
stage.classList.add("is-ready");

const clock = new THREE.Clock();
let frameRequested = false;
function renderFrame() {
  const elapsed = clock.getElapsedTime();
  if (!pointerDown && !reducedMotion) {
    ballGroup.rotation.y += 0.0025 + dragVelocity;
    ballGroup.rotation.x += (Math.sin(elapsed * 0.34) * 0.08 - ballGroup.rotation.x) * 0.012;
    dragVelocity *= 0.97;
  }
  renderer.render(scene, camera);
  if (!reducedMotion || pointerDown) requestAnimationFrame(renderFrame);
  else frameRequested = false;
}
function requestRender() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(renderFrame);
}
requestRender();
stage.addEventListener("pointermove", () => {
  if (pointerDown && reducedMotion) requestRender();
});

const form = document.querySelector("#contact-form");
const formNote = document.querySelector("#form-note");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const values = new FormData(form);
  const name = String(values.get("name")).trim();
  const email = String(values.get("email")).trim();
  const message = String(values.get("message")).trim();
  if (!name || !email || !message) return;

  const subject = `ZFORCE website enquiry from ${name}`;
  const body = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;
  window.location.href = `mailto:zforcesportz@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  formNote.textContent = "Your email app should open with your message ready to send. If not, email zforcesportz@gmail.com directly.";
  formNote.classList.remove("is-error");
});

document.querySelector("#year").textContent = String(new Date().getFullYear());

window.addEventListener("beforeunload", () => {
  resizeObserver.disconnect();
  renderer.dispose();
});
