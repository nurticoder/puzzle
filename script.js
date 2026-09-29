const board = document.querySelector("#board");
const timeEl = document.querySelector("#time");
const movesEl = document.querySelector("#moves");
const bestEl = document.querySelector("#best");
const winOverlay = document.querySelector("#winOverlay");
const winMoves = document.querySelector("#winMoves");
const winTime = document.querySelector("#winTime");
let size = 4;
let tiles = [];
let moves = 0;
let seconds = 0;
let timer = null;
let started = false;
let touchStart = null;
let touchedTileIndex = null;
let suppressClickUntil = 0;
let boardResizeObserver = null;

const bestKey = () => `slidewise-best-${size}`;
const formatTime = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const isSolved = () => tiles.every((value, index) => value === (index === tiles.length - 1 ? 0 : index + 1));
const emptyIndex = () => tiles.indexOf(0);
const canMove = (index) => {
  const empty = emptyIndex();
  const row = Math.floor(index / size), col = index % size;
  const emptyRow = Math.floor(empty / size), emptyCol = empty % size;
  return Math.abs(row - emptyRow) + Math.abs(col - emptyCol) === 1;
};

function render() {
  const activeValues = new Set(tiles.map(String));
  [...board.children].forEach((tile) => {
    if (!activeValues.has(tile.dataset.value)) tile.remove();
  });

  tiles.forEach((value, index) => {
    let tile = board.querySelector(`[data-value="${value}"]`);
    if (!tile) {
      tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.addEventListener("click", () => {
        if (Date.now() < suppressClickUntil) return;
        move(Number(tile.dataset.index));
      });
      board.appendChild(tile);
    }
    tile.classList.toggle("empty", value === 0);
    tile.disabled = value === 0;
    tile.textContent = value || "";
    tile.dataset.value = value;
    tile.dataset.index = index;
    tile.setAttribute("aria-label", value ? `Tile ${value}` : "Empty space");
  });
  layoutTiles();
}

function layoutTiles() {
  const gap = window.matchMedia("(max-width: 700px)").matches ? 5 : 8;
  const padding = gap;
  const cell = (board.clientWidth - padding * 2 - gap * (size - 1)) / size;
  [...board.children].forEach((tile) => {
    const index = Number(tile.dataset.index);
    const column = index % size;
    const row = Math.floor(index / size);
    tile.style.width = `${cell}px`;
    tile.style.height = `${cell}px`;
    tile.style.left = `${padding + column * (cell + gap)}px`;
    tile.style.top = `${padding + row * (cell + gap)}px`;
  });
}

function move(index) {
  if (!canMove(index)) return;
  if (!started) { started = true; timer = setInterval(() => { seconds += 1; timeEl.textContent = formatTime(seconds); }, 1000); }
  const empty = emptyIndex();
  [tiles[index], tiles[empty]] = [tiles[empty], tiles[index]];
  moves += 1; movesEl.textContent = moves; render();
  if (isSolved()) finish();
}

function shuffle() {
  stopTimer(); winOverlay.hidden = true; moves = 0; seconds = 0; started = false;
  movesEl.textContent = "0"; timeEl.textContent = "00:00";
  tiles = Array.from({ length: size * size }, (_, index) => index + 1);
  tiles[tiles.length - 1] = 0;
  let previous = -1;
  for (let i = 0; i < Math.max(80, size * size * 12); i += 1) {
    const options = tiles.map((_, index) => index).filter((index) => canMove(index) && index !== previous);
    const chosen = options[Math.floor(Math.random() * options.length)];
    previous = emptyIndex(); [tiles[chosen], tiles[previous]] = [tiles[previous], tiles[chosen]];
  }
  render(); updateBest();
}

function stopTimer() { if (timer) clearInterval(timer); timer = null; }
function finish() {
  stopTimer(); started = false;
  const currentBest = JSON.parse(localStorage.getItem(bestKey()) || "null");
  if (!currentBest || moves < currentBest.moves || (moves === currentBest.moves && seconds < currentBest.seconds)) {
    localStorage.setItem(bestKey(), JSON.stringify({ moves, seconds }));
  }
  winMoves.textContent = `${moves} move${moves === 1 ? "" : "s"}`;
  winTime.textContent = formatTime(seconds); winOverlay.hidden = false; updateBest();
}
function updateBest() {
  const best = JSON.parse(localStorage.getItem(bestKey()) || "null");
  bestEl.textContent = best ? `${best.moves} / ${formatTime(best.seconds)}` : "—";
}
function changeSize(newSize) {
  size = Math.max(3, Math.min(8, Number(newSize) || 4));
  document.querySelectorAll("[data-size]").forEach((button) => button.classList.toggle("active", Number(button.dataset.size) === size));
  document.querySelector("#customSize").value = size; shuffle();
}
board.addEventListener("keydown", (event) => {
  const empty = emptyIndex(), row = Math.floor(empty / size), col = empty % size;
  const target = { ArrowUp: empty + size, ArrowDown: empty - size, ArrowLeft: empty + 1, ArrowRight: empty - 1 }[event.key];
  if (target !== undefined && target >= 0 && target < tiles.length && Math.abs(Math.floor(target / size) - row) + Math.abs((target % size) - col) === 1) { event.preventDefault(); move(target); }
});
board.addEventListener("touchstart", (event) => {
  touchStart = event.changedTouches[0];
  const tile = event.target.closest(".tile:not(.empty)");
  touchedTileIndex = tile ? Number(tile.dataset.index) : null;
}, { passive: true });
board.addEventListener("touchend", (event) => {
  if (!touchStart) return;
  const touch = event.changedTouches[0], dx = touch.clientX - touchStart.clientX, dy = touch.clientY - touchStart.clientY;
  const wasSwipe = Math.max(Math.abs(dx), Math.abs(dy)) > 24;
  suppressClickUntil = Date.now() + 500;
  if (wasSwipe) {
    event.preventDefault();
    const empty = emptyIndex(), row = Math.floor(empty / size), col = empty % size;
    const target = Math.abs(dx) > Math.abs(dy) ? empty + (dx > 0 ? 1 : -1) : empty + (dy > 0 ? size : -size);
    if (target >= 0 && target < tiles.length && Math.abs(Math.floor(target / size) - row) + Math.abs((target % size) - col) === 1) move(target);
  } else if (touchedTileIndex !== null) {
    event.preventDefault();
    move(touchedTileIndex);
  }
  touchStart = null;
  touchedTileIndex = null;
}, { passive: false });
document.querySelectorAll("[data-size]").forEach((button) => button.addEventListener("click", () => changeSize(button.dataset.size)));
document.querySelector("#applySize").addEventListener("click", () => changeSize(document.querySelector("#customSize").value));
document.querySelector("#customSize").addEventListener("keydown", (event) => { if (event.key === "Enter") changeSize(event.target.value); });
document.querySelector("#shuffle").addEventListener("click", shuffle);
document.querySelector("#reset").addEventListener("click", () => { tiles = Array.from({ length: size * size }, (_, index) => index === size * size - 1 ? 0 : index + 1); stopTimer(); moves = 0; seconds = 0; started = false; movesEl.textContent = "0"; timeEl.textContent = "00:00"; winOverlay.hidden = true; render(); updateBest(); });
document.querySelector("#nextGame").addEventListener("click", shuffle);
document.querySelector("#themeButton").addEventListener("click", () => document.body.classList.toggle("dark"));
boardResizeObserver = new ResizeObserver(layoutTiles);
boardResizeObserver.observe(board);
shuffle();
