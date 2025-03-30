//#region Setup
//#region Constants
/**
 * Enum for difficulty levels.
 * @readonly
 * @enum
 */
const Difficulty = Object.freeze({
  beginner: Symbol("beginner"),
  intermediate: Symbol("intermediate"),
  expert: Symbol("expert"),
});

/**
 * Unicode number characters for css class injection.
 * @readonly
 * @enum
 */
const UnicodeNumbers = Object.freeze({
  0: String.fromCodePoint(0x30),
  1: String.fromCodePoint(0x31),
  2: String.fromCodePoint(0x32),
  3: String.fromCodePoint(0x33),
  4: String.fromCodePoint(0x34),
  5: String.fromCodePoint(0x35),
  6: String.fromCodePoint(0x36),
  7: String.fromCodePoint(0x37),
  8: String.fromCodePoint(0x38),
  9: String.fromCodePoint(0x39),
});

const urlParams = new URLSearchParams(window.location.search);
const diffParam = urlParams.get("diff") || "beginner";
const DIFFICULTY = Difficulty[diffParam] || Symbol("beginner");

const GAME_SETTINGS = {
  rows: 9,
  columns: 9,
  mines: 10,
};
switch (DIFFICULTY) {
  case Difficulty.intermediate:
    GAME_SETTINGS.rows = 16;
    GAME_SETTINGS.columns = 16;
    GAME_SETTINGS.mines = 40;
    break;
  case Difficulty.expert:
    GAME_SETTINGS.rows = 16;
    GAME_SETTINGS.columns = 30;
    GAME_SETTINGS.mines = 99;
    break;
  case Difficulty.beginner:
  default:
    break;
}

/**
 * @type {Set<string>}
 */
const cellsOpened = new Set();
//#endregion
let flagsPlaced = 0;
let minesFlagged = 0;
let gameEnded = false;
let timeInterval = null;
let timeElapsed = 0;
/**
 * @type {HTMLTableElement}
 */
let mineGridTable = null;
/**
 * @type {HTMLTableElement}
 */
let timeDisplay = null;
/**
 * @type {HTMLTableElement}
 */
let mineDisplay = null;
/**
 * @type {HTMLDivElement}
 */
let controlButton = null;
//#endregion

/**
 * Handles click event on table cell.
 * @param {PointerEvent} event
 * @returns
 */
function handleClickCell(event) {
  /**
   * @type {HTMLTableCellElement}
   */
  const cell = event.target;
  const mouseButtonType = event.button;
  const cellIndex = cell.cellIndex;
  const rowIndex = cell.parentElement.rowIndex;
  if (mouseButtonType === 0) {
    // 0 = Left mouse button
    handleLeftMouseButtonClick(cell, rowIndex, cellIndex);
  } else if (mouseButtonType === 2) {
    // 2 = Right mouse button
    handleRightMouseButtonClick(cell);
  }
  updateMineDisplay();
  if (
    minesFlagged === GAME_SETTINGS.mines &&
    cellsOpened.size ===
      GAME_SETTINGS.columns * GAME_SETTINGS.rows - GAME_SETTINGS.mines
  ) {
    win();
  }
}

/**
 * @param {HTMLTableCellElement} cell Clicked cell element
 * @param {number} rowIndex Row index of `cell`
 * @param {number} columnIndex Column index of `cell`
 * @returns
 */
function handleLeftMouseButtonClick(cell, rowIndex, columnIndex) {
  if (!cell.classList.contains("open") && !cell.classList.contains("flag")) {
    if (cell.dataset.mine !== undefined) {
      cell.classList.add("open", "mine", "exploded");
      lose(cell);
    } else {
      revealCells(cell, rowIndex, columnIndex);
    }
  }
}

/**
 * @param {HTMLTableCellElement} cell Clicked cell element
 * @returns
 */
function handleRightMouseButtonClick(cell) {
  if (!cell.classList.contains("open")) {
    if (cell.classList.contains("flag")) {
      cell.classList.remove("flag");
      flagsPlaced--;
      if (cell.dataset.mine !== undefined) {
        minesFlagged--;
      }
    } else if (flagsPlaced < GAME_SETTINGS.mines) {
      cell.classList.add("flag");
      flagsPlaced++;
      if (cell.dataset.mine !== undefined) {
        minesFlagged++;
      }
    }
  }
}

/**
 * Reveals cells until cells with mines around are revealed.
 * @param {HTMLTableCellElement} startingCell
 * @param {number} startingCellRowIndex
 * @param {number} startingCellColIndex
 * @returns
 */
function revealCells(startingCell, startingCellRowIndex, startingCellColIndex) {
  /**
   * @type {Array<HTMLTableCellElement>}
   */
  const cellStack = [];
  const cellStackSet = new Set();
  cellStack.push(startingCell);
  cellStackSet.add(`${startingCellRowIndex},${startingCellColIndex}`);

  while (cellStack.length > 0) {
    const currentCell = cellStack.shift();
    const currentCellPosition = {
      row: currentCell.parentElement.rowIndex,
      col: currentCell.cellIndex,
    };
    const currentCellPositionString =
      Object.values(currentCellPosition).join(",");
    cellStackSet.delete(currentCellPositionString);

    if (
      currentCell.dataset.mine !== undefined ||
      currentCell.classList.contains("flag")
    ) {
      continue;
    }

    cellsOpened.add(currentCellPositionString);

    const surroundingMineCount = getSurroundingCellsMineCount(
      currentCellPosition.row,
      currentCellPosition.col
    );

    currentCell.classList.add("open", UnicodeNumbers[surroundingMineCount]);

    if (surroundingMineCount === 0) {
      const surroundingCells = getSurroundingCells(
        currentCellPosition.row,
        currentCellPosition.col
      );

      for (const cell of surroundingCells) {
        const cellPosition = {
          row: cell.parentElement.rowIndex,
          col: cell.cellIndex,
        };
        const cellPositionString = Object.values(cellPosition).join(",");
        if (
          !cellsOpened.has(cellPositionString) &&
          !cellStackSet.has(cellPositionString)
        ) {
          cellStack.push(cell);
        }
      }
    }
  }
}

/**
 * Returns array of `HTMLTableCellElement` objects surrounding a cell defined by the parameters.
 * @param {number} cellRowIndex
 * @param {number} cellColIndex
 * @returns {Array<HTMLTableCellElement>}
 */
function getSurroundingCells(cellRowIndex, cellColIndex) {
  const rows = mineGridTable.rows;
  /**
   * @type {Array<HTMLTableCellElement>}
   */
  const surroundingCells = [];
  for (
    let rowIndex = cellRowIndex - 1;
    rowIndex <= cellRowIndex + 1;
    rowIndex++
  ) {
    if (rowIndex < 0 || rowIndex > GAME_SETTINGS.rows - 1) continue;
    for (
      let colIndex = cellColIndex - 1;
      colIndex <= cellColIndex + 1;
      colIndex++
    ) {
      if (
        colIndex < 0 ||
        colIndex > GAME_SETTINGS.columns - 1 ||
        (colIndex === cellColIndex && rowIndex === cellRowIndex)
      )
        continue;
      surroundingCells.push(rows.item(rowIndex).cells.item(colIndex));
    }
  }
  return surroundingCells;
}

/**
 * Returns the number of mines in the surrounding cells.
 * @param {number} cellRowIndex
 * @param {number} cellColIndex
 * @returns {number}
 */
function getSurroundingCellsMineCount(cellRowIndex, cellColIndex) {
  const surroundingCells = getSurroundingCells(cellRowIndex, cellColIndex);
  return surroundingCells.filter((cell) => cell.dataset.mine !== undefined)
    .length;
}

/**
 * Creates a set with unique mine position string of the following format: `"3,1"`.
 * @param {number} mineCount number of mine positions to generate
 * @param {number} rows number of available rows
 * @param {number} columns number of available columns
 * @returns {Set<string>}
 */
function generateMinePositions(mineCount, rows, columns) {
  const positions = new Set();
  for (let i = 0; i < mineCount; i++) {
    let pos = [
      Math.floor(Math.random() * rows),
      Math.floor(Math.random() * columns),
    ];
    let posString = pos.join(",");
    while (positions.has(posString)) {
      pos = [
        Math.floor(Math.random() * rows),
        Math.floor(Math.random() * columns),
      ];
      posString = pos.join(",");
    }
    positions.add(posString);
  }
  return positions;
}

/**
 * Builds mine grid table rows based on difficulty.
 * @param {{mines: number, rows: number, columns: number}} settings
 * @returns
 */
function buildMineGrid(settings) {
  const minePositions = generateMinePositions(
    settings.mines,
    settings.rows,
    settings.columns
  );
  for (let rowIndex = 0; rowIndex < settings.rows; rowIndex++) {
    const row = mineGridTable.insertRow(rowIndex);
    for (let columnIndex = 0; columnIndex < settings.columns; columnIndex++) {
      const posString = [rowIndex, columnIndex].join(",");
      const cell = row.insertCell(columnIndex);
      cell.classList.add("cell");
      if (minePositions.has(posString)) {
        cell.dataset.mine = true;
      }
      cell.addEventListener("mousedown", handleClickCell);
    }
  }
}

/**
 * Resets mine grid table.
 * @param {{mines: number, rows: number, columns: number}} settings
 * @returns
 */
function resetMineGrid(settings) {
  const minePositions = generateMinePositions(
    settings.mines,
    settings.rows,
    settings.columns
  );
  cellsOpened.clear();
  flagsPlaced = 0;
  minesFlagged = 0;
  for (let rowIndex = 0; rowIndex < settings.rows; rowIndex++) {
    mineGridTable.deleteRow(rowIndex);
    const row = mineGridTable.insertRow(rowIndex);
    for (let columnIndex = 0; columnIndex < settings.columns; columnIndex++) {
      const posString = [rowIndex, columnIndex].join(",");
      const cell = row.insertCell(columnIndex);
      cell.classList.add("cell");
      if (minePositions.has(posString)) {
        cell.dataset.mine = true;
      }
      cell.addEventListener("mousedown", handleClickCell);
    }
  }
}

/**
 * Handles the reset of the game.
 * @returns
 */
function resetGame() {
  resetMineGrid(GAME_SETTINGS);
  updateMineDisplay();
  controlButton.classList.remove("dead");
  controlButton.classList.remove("cool");
  gameEnded = false;
  resetTimer();
}

/**
 * Handles the event when player wins the game.
 * @returns
 */
function win() {
  gameEnded = true;
  stopTimer();
  controlButton.classList.add("cool");
}

/**
 * Handles the event when player loses the game.
 * @param {HTMLTableCellElement} lastClickedCell The cell that caused the user to lose
 * @returns
 */
function lose(lastClickedCell) {
  gameEnded = true;
  stopTimer();
  for (const row of mineGridTable.rows) {
    for (const cell of row.cells) {
      if (cell.dataset.mine !== undefined) {
        if (!cell.classList.contains("flag")) {
          cell.classList.add("open", "mine");
        }
      } else if (cell.classList.contains("flag")) {
        cell.classList.remove("flag");
        cell.classList.add("open", "mine", "false");
      } else {
        revealCells(cell);
      }
    }
  }
  lastClickedCell.classList.add("exploded");
  controlButton.classList.add("dead");
}

/**
 * Handles the update of mine display segments.
 * @returns
 */
function updateMineDisplay() {
  const numberToDisplay = (GAME_SETTINGS.mines - flagsPlaced)
    .toString()
    .padStart(3, "0");
  const segments = mineDisplay.rows.item(0);
  const firstSegment = segments.cells.item(0);
  const secondSegment = segments.cells.item(1);
  const thirdSegment = segments.cells.item(2);
  firstSegment.classList.remove(firstSegment.classList.value.split(" ").pop());
  firstSegment.classList.add(UnicodeNumbers[numberToDisplay[0]]);
  secondSegment.classList.remove(
    secondSegment.classList.value.split(" ").pop()
  );
  secondSegment.classList.add(UnicodeNumbers[numberToDisplay[1]]);
  thirdSegment.classList.remove(thirdSegment.classList.value.split(" ").pop());
  thirdSegment.classList.add(UnicodeNumbers[numberToDisplay[2]]);
}

/**
 * Handles the update of time display segments.
 * @param {number} time
 * @returns
 */
function updateTimeDisplay(time) {
  const segments = timeDisplay.rows.item(0);
  const timeElapsedString = time.toString().padStart(3, "0");
  const firstSegment = segments.cells.item(0);
  const secondSegment = segments.cells.item(1);
  const thirdSegment = segments.cells.item(2);
  firstSegment.classList.remove(firstSegment.classList.value.split(" ").pop());
  firstSegment.classList.add(UnicodeNumbers[timeElapsedString[0]]);
  secondSegment.classList.remove(
    secondSegment.classList.value.split(" ").pop()
  );
  secondSegment.classList.add(UnicodeNumbers[timeElapsedString[1]]);
  thirdSegment.classList.remove(thirdSegment.classList.value.split(" ").pop());
  thirdSegment.classList.add(UnicodeNumbers[timeElapsedString[2]]);
}

/**
 * Handles the update of elapsed time.
 * @returns
 */
function timer() {
  timeElapsed++;
  updateTimeDisplay(Math.min(timeElapsed, 999));
}

/**
 * Starts the game timer.
 * @returns
 */
function startTimer() {
  timeInterval = setInterval(timer, 1000);
}

/**
 * Resets the game timer. Calls `updateTimeDisplay` to blit 0 to indicate the reset.
 * @returns
 */
function resetTimer() {
  stopTimer();
  timeElapsed = 0;
  updateTimeDisplay(timeElapsed);
  startTimer();
}

/**
 * Stops the game timer.
 * @returns
 */
function stopTimer() {
  clearInterval(timeInterval);
}

/**
 * Builds the table layout based on the difficulty level.
 * @returns
 */
function buildLayout() {
  /**
   * @type {HTMLTableElement}
   */
  const layoutTable = document.getElementById("layout-table");
  const layoutRows = layoutTable.rows;
  const topBorder = layoutRows.item(0);
  const middleBorder = layoutRows.item(2);
  const bottomBorder = layoutRows.item(layoutRows.length - 1);
  for (let i = 1; i <= GAME_SETTINGS.columns - 9; i++) {
    let cell = topBorder.insertCell(i);
    cell.classList.add("horizontal");
    cell = middleBorder.insertCell(i);
    cell.classList.add("horizontal");
    cell = bottomBorder.insertCell(i);
    cell.classList.add("horizontal");
  }
  const displayCell = document.getElementById("display-cell");
  displayCell.colSpan += GAME_SETTINGS.columns - 9;
  const mineGridCell = document.getElementById("mine-grid-cell");
  mineGridCell.colSpan += GAME_SETTINGS.columns - 9;
  mineGridCell.rowSpan += GAME_SETTINGS.rows - 9;
  for (let j = 4; j <= GAME_SETTINGS.rows + 3 - 9; j++) {
    const row = layoutTable.insertRow(j);
    for (let k = 0; k < 2; k++) {
      const cell = row.insertCell(k);
      cell.classList.add("vertical-small");
    }
  }
  /**
   * @type {HTMLTableCellElement}
   */
}

/**
 * Adds mouse event listeners to `mineGridTable` that update control button.
 * @returns
 */
function addMineGridEventListeners() {
  mineGridTable.addEventListener("mousedown", (event) => {
    if (gameEnded) return;
    if (event.button !== 0) return;
    controlButton.classList.add("suspense");
  });
  mineGridTable.addEventListener("mouseup", (event) => {
    if (gameEnded) return;
    if (event.button !== 0) return;
    controlButton.classList.remove("suspense");
  });
  mineGridTable.addEventListener("mouseleave", () =>
    controlButton.classList.remove("suspense")
  );
}

window.onload = () => {
  console.log(
    "⚠️ Context menu has been disabled by the script to allow the use of RMB click for placing flags."
  );
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  buildLayout();
  mineGridTable = document.getElementById("mine-grid");
  timeDisplay = document.getElementById("time-display");
  mineDisplay = document.getElementById("mine-display");
  controlButton = document.getElementById("control-button");
  controlButton.addEventListener("click", resetGame);
  buildMineGrid(GAME_SETTINGS);
  addMineGridEventListeners();
  startTimer();
  updateMineDisplay();
};

window.onbeforeunload = () => {
  document.removeEventListener("contextmenu", (e) => e.preventDefault());
};
