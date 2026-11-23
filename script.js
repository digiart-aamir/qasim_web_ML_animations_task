"use strict";

(() => {
  const canvas = document.getElementById("chart");
  const context = canvas.getContext("2d");
  const points = [];
  const plot = { left: 58, right: 578, top: 24, bottom: 350 };
  const xMin = 0;
  const xMax = 100;
  const yMin = 0;
  const yMax = 100;
  const tickStep = 10;
  let showResiduals = false;
  let model = null;
  let prediction = null;
  let predictionRequested = false;

  const pointCount = document.getElementById("point-count");
  const equation = document.getElementById("equation");
  const slopeValue = document.getElementById("slope-value");
  const interceptValue = document.getElementById("intercept-value");
  const r2Value = document.getElementById("r2-value");
  const mseValue = document.getElementById("mse-value");
  const modelStatus = document.getElementById("model-status");
  const modelBadge = modelStatus.closest(".model-badge");
  const predictionOutput = document.getElementById("prediction-output");
  const predictionNote = document.getElementById("prediction-note");
  const xInput = document.getElementById("x-input");
  const residualsButton = document.getElementById("residuals-button");

  function formatNumber(value, digits = 2) {
    return Number.isFinite(value) ? value.toFixed(digits) : "—";
  }

  function fitLinearRegression(dataPoints) {
    if (!Array.isArray(dataPoints) || dataPoints.length < 2) {
      return null;
    }

    const meanX = dataPoints.reduce((sum, point) => sum + point.x, 0) / dataPoints.length;
    const meanY = dataPoints.reduce((sum, point) => sum + point.y, 0) / dataPoints.length;
    const denominator = dataPoints.reduce(
      (sum, point) => sum + (point.x - meanX) ** 2,
      0
    );

    if (denominator === 0) {
      return null;
    }

    const numerator = dataPoints.reduce(
      (sum, point) => sum + (point.x - meanX) * (point.y - meanY),
      0
    );
    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;
    const SS_res = dataPoints.reduce(
      (sum, point) => sum + (point.y - (slope * point.x + intercept)) ** 2,
      0
    );
    const SS_tot = dataPoints.reduce(
      (sum, point) => sum + (point.y - meanY) ** 2,
      0
    );

    return {
      meanX,
      meanY,
      slope,
      intercept,
      r2: SS_tot === 0 ? (SS_res === 0 ? 1 : 0) : 1 - SS_res / SS_tot,
      mse: SS_res / dataPoints.length
    };
  }

  function drawChart() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#101520";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = "11px 'Segoe UI', Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "top";
    for (let value = xMin; value <= xMax; value += tickStep) {
      const x = toCanvasX(value);
      context.beginPath();
      context.strokeStyle = value === xMin ? "#556075" : "#252c3b";
      context.lineWidth = 1;
      context.moveTo(x, plot.top);
      context.lineTo(x, plot.bottom);
      context.stroke();
      context.fillStyle = "#9aa5ba";
      context.fillText(String(value), x, plot.bottom + 12);
    }

    context.textAlign = "right";
    context.textBaseline = "middle";
    for (let value = yMin; value <= yMax; value += tickStep) {
      const y = toCanvasY(value);
      context.beginPath();
      context.strokeStyle = value === yMin ? "#556075" : "#252c3b";
      context.lineWidth = 1;
      context.moveTo(plot.left, y);
      context.lineTo(plot.right, y);
      context.stroke();
      context.fillStyle = "#9aa5ba";
      context.fillText(String(value), plot.left - 10, y);
    }

    context.fillStyle = "#c1c8d8";
    context.font = "11px 'Segoe UI', Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillText("X value", (plot.left + plot.right) / 2, 391);
    context.save();
    context.translate(16, (plot.top + plot.bottom) / 2);
    context.rotate(-Math.PI / 2);
    context.fillText("Y value", 0, 0);
    context.restore();

    if (model) {
      context.save();
      context.beginPath();
      context.rect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
      context.clip();

      context.beginPath();
      context.moveTo(toCanvasX(xMin), toCanvasY(model.slope * xMin + model.intercept));
      context.lineTo(toCanvasX(xMax), toCanvasY(model.slope * xMax + model.intercept));
      context.strokeStyle = "#f087a2";
      context.lineWidth = 2.5;
      context.stroke();

      if (showResiduals) {
        context.save();
        context.setLineDash([4, 4]);
        context.strokeStyle = "#a4aec1";
        context.lineWidth = 1.25;
        points.forEach((point) => {
          const pointPosition = toCanvasCoordinates(point);
          const predictionPosition = toCanvasCoordinates({
            x: point.x,
            y: model.slope * point.x + model.intercept
          });
          context.beginPath();
          context.moveTo(pointPosition.px, pointPosition.py);
          context.lineTo(predictionPosition.px, predictionPosition.py);
          context.stroke();
        });
        context.restore();
      }

      context.restore();
    }

    points.forEach((point) => {
      const { px, py } = toCanvasCoordinates(point);
      context.beginPath();
      context.arc(px, py, 5, 0, Math.PI * 2);
      context.fillStyle = "#9a8cff";
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = "#e7e2ff";
      context.stroke();
    });

    if (
      prediction &&
      prediction.x >= xMin &&
      prediction.x <= xMax &&
      prediction.y >= yMin &&
      prediction.y <= yMax
    ) {
      const { px, py } = toCanvasCoordinates(prediction);
      context.save();
      context.beginPath();
      context.rect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
      context.clip();

      context.beginPath();
      context.arc(px, py, 7, 0, Math.PI * 2);
      context.fillStyle = "#ffd166";
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = "#fff2c2";
      context.stroke();

      context.fillStyle = "#ffd166";
      context.font = "bold 11px 'Segoe UI', Arial, sans-serif";
      context.textAlign = px > plot.right - 72 ? "right" : "left";
      context.textBaseline = py < plot.top + 20 ? "top" : "bottom";
      context.fillText(
        "Predicted",
        px + (context.textAlign === "left" ? 11 : -11),
        py + (context.textBaseline === "top" ? 10 : -10)
      );
      context.restore();
    }
  }

  function toCanvasX(x) {
    return plot.left + ((x - xMin) / (xMax - xMin)) * (plot.right - plot.left);
  }

  function toCanvasY(y) {
    return plot.bottom - ((y - yMin) / (yMax - yMin)) * (plot.bottom - plot.top);
  }

  function toCanvasCoordinates({ x, y }) {
    return { px: toCanvasX(x), py: toCanvasY(y) };
  }

  function toDataCoordinates(px, py) {
    const boundedX = Math.max(plot.left, Math.min(plot.right, px));
    const boundedY = Math.max(plot.top, Math.min(plot.bottom, py));
    return {
      x: xMin + ((boundedX - plot.left) / (plot.right - plot.left)) * (xMax - xMin),
      y: yMin + ((plot.bottom - boundedY) / (plot.bottom - plot.top)) * (yMax - yMin)
    };
  }

  function updateView() {
    model = fitLinearRegression(points);
    pointCount.textContent = String(points.length);

    if (!model) {
      equation.textContent = "y = —x + —";
      slopeValue.textContent = "—";
      interceptValue.textContent = "—";
      r2Value.textContent = "—";
      mseValue.textContent = "—";
      modelStatus.textContent = points.length < 2 ? "Waiting for data" : "Need varied X";
      modelBadge.classList.remove("is-ready");
    } else {
      const interceptSign = model.intercept < 0 ? "−" : "+";
      equation.textContent = `y = ${formatNumber(model.slope)}x ${interceptSign} ${formatNumber(Math.abs(model.intercept))}`;
      slopeValue.textContent = formatNumber(model.slope);
      interceptValue.textContent = formatNumber(model.intercept);
      r2Value.textContent = formatNumber(model.r2, 3);
      mseValue.textContent = formatNumber(model.mse, 3);
      modelStatus.textContent = "Model ready";
      modelBadge.classList.add("is-ready");
    }

    updatePrediction();
    drawChart();
  }

  function updatePrediction() {
    prediction = null;

    if (!predictionRequested) {
      predictionOutput.textContent = "—";
      predictionNote.textContent = model
        ? "Enter an X value and predict its Y."
        : "Add at least two points to fit a line.";
      return;
    }

    if (!model) {
      predictionOutput.textContent = "—";
      predictionNote.textContent = "Add at least two points with different X values first.";
      return;
    }

    const rawX = xInput.value.trim();
    const x = xInput.valueAsNumber;
    if (rawX === "" || !Number.isFinite(x) || !xInput.validity.valid) {
      predictionOutput.textContent = "—";
      predictionNote.textContent = "Enter a valid X value.";
      return;
    }

    const y = model.slope * x + model.intercept;
    if (!Number.isFinite(y)) {
      predictionOutput.textContent = "—";
      predictionNote.textContent = "The model could not calculate a prediction for this X value.";
      return;
    }

    prediction = { x, y };
    predictionOutput.textContent = formatNumber(y);
    predictionNote.textContent = `For X = ${formatNumber(x)}, using the current regression line.`;
  }

  canvas.addEventListener("click", (event) => {
    const bounds = canvas.getBoundingClientRect();
    const canvasX = ((event.clientX - bounds.left) / bounds.width) * canvas.width;
    const canvasY = ((event.clientY - bounds.top) / bounds.height) * canvas.height;
    points.push(toDataCoordinates(canvasX, canvasY));
    updateView();
  });

  document.getElementById("generate-button").addEventListener("click", () => {
    points.length = 0;
    for (let index = 0; index < 18; index += 1) {
      const x = 4 + index * 5.4;
      const noise = (Math.random() - 0.5) * 11;
      const y = Math.max(yMin, Math.min(yMax, 12 + 0.72 * x + noise));
      points.push({ x, y });
    }
    updateView();
  });

  document.getElementById("clear-button").addEventListener("click", () => {
    points.length = 0;
    updateView();
  });

  residualsButton.addEventListener("click", () => {
    showResiduals = !showResiduals;
    residualsButton.setAttribute("aria-pressed", String(showResiduals));
    residualsButton.textContent = showResiduals ? "Hide Residuals" : "Show Residuals";
    drawChart();
  });

  const predictionForm = document.getElementById("prediction-form");
  predictionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    predictionRequested = true;
    updatePrediction();
    drawChart();
  });

  xInput.addEventListener("input", () => {
    if (predictionRequested) {
      updatePrediction();
      drawChart();
    }
  });

  xInput.addEventListener("invalid", () => {
    predictionRequested = true;
    updatePrediction();
    drawChart();
  });

  updateView();
})();
