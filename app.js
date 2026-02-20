(function () {
  'use strict';

  const STORAGE_KEYS = {
    periods: 'periodassist_periods',
    focusDays: 'periodassist_focus_days',
  };

  // Phase info by cycle day (1-based). Ranges: Menstrual 1–7, Follicular 8–14, Ovulation 14–17, Luteal 18–28+
  const PHASES = [
    { id: 'menstrual', name: 'Menstrual Phase', days: 'Days 1–5/7', dayMin: 1, dayMax: 7,
      hormones: 'Estrogen and progesterone are at their lowest.',
      mood: 'Fatigue, low energy, and irritability are common. You may feel more introspective or sluggish.',
      food: 'Iron-rich foods to replenish blood loss (red meat, lentils, spinach), foods rich in Vitamin C (citrus, broccoli) to boost iron absorption, and anti-inflammatory foods like fatty fish (salmon) to reduce cramps.',
      exercise: 'Gentle movement: walking, restorative yoga, stretching, or Pilates.' },
    { id: 'follicular', name: 'Follicular Phase', days: 'Days 1–13/14', dayMin: 8, dayMax: 14,
      hormones: 'Estrogen begins to rise, signaling the end of the period.',
      mood: 'Energy levels, mental clarity, and mood improve. You may feel more sociable, creative, and motivated.',
      food: 'Nutrient-dense foods that support rising energy: leafy greens, lean proteins (chicken, fish), healthy fats (avocado), and complex carbohydrates (quinoa, oats).',
      exercise: 'Increasing intensity: jogging, swimming, cycling, or moderate strength training.' },
    { id: 'ovulation', name: 'Ovulation Phase', days: 'Approx. Days 14–17', dayMin: 14, dayMax: 17,
      hormones: 'Estrogen and testosterone peak.',
      mood: 'Peak energy, libido, and confidence.',
      food: 'Antioxidant-rich foods to support hormonal changes: berries, leafy greens, and fiber-rich foods like cruciferous vegetables (broccoli, Brussels sprouts) to support the liver in processing estrogen.',
      exercise: 'High-intensity workouts (HIIT), heavy lifting, or challenging running sessions. Take advantage of peak strength.' },
    { id: 'luteal', name: 'Luteal Phase', days: 'Days 15–28', dayMin: 18, dayMax: 35,
      hormones: 'Progesterone rises, then drops if no pregnancy occurs, along with a drop in estrogen.',
      mood: 'Potential for PMS, irritability, fatigue, and food cravings (often due to dropping serotonin).',
      food: 'Complex, fiber-rich carbohydrates (sweet potatoes, root vegetables) to stabilize blood sugar, and magnesium-rich foods (dark chocolate, pumpkin seeds) to combat PMS.',
      exercise: 'Shift to moderate/lower intensity: brisk walking, Pilates, or strength training with lighter weights.' },
  ];

  let state = {
    periods: [],       // { start: Date, end: Date }[]
    focusDays: {},     // 'YYYY-MM-DD' -> true
    viewDate: new Date(),
  };

  function loadState() {
    try {
      const p = localStorage.getItem(STORAGE_KEYS.periods);
      if (p) state.periods = JSON.parse(p).map(r => ({ start: new Date(r.start), end: new Date(r.end) }));
      const f = localStorage.getItem(STORAGE_KEYS.focusDays);
      if (f) state.focusDays = JSON.parse(f);
    } catch (_) {}
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEYS.periods, JSON.stringify(state.periods.map(r => ({
      start: r.start.toISOString(),
      end: r.end.toISOString(),
    }))));
    localStorage.setItem(STORAGE_KEYS.focusDays, JSON.stringify(state.focusDays));
  }

  function isPeriodDay(d) {
    const key = formatDateKey(d);
    return state.periods.some(p => {
      const start = dateOnly(p.start);
      const end = dateOnly(p.end);
      const day = dateOnly(d);
      return day >= start && day <= end;
    });
  }

  function dateOnly(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }

  function formatDateKey(d) {
    const x = new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }

  /** Get cycle day (1-based) for a date from period data. Returns null if unknown. */
  function getCycleDay(date) {
    if (!state.periods.length) return null;
    const d = dateOnly(date);
    const starts = state.periods.map(p => dateOnly(p.start)).filter(s => s <= d);
    if (!starts.length) return null;
    const lastStart = Math.max(...starts);
    const cycleDay = Math.floor((d - lastStart) / (24 * 60 * 60 * 1000)) + 1;
    return cycleDay > 0 ? cycleDay : null;
  }

  function getPhaseForCycleDay(cycleDay) {
    if (!cycleDay) return null;
    for (const phase of PHASES) {
      if (cycleDay >= phase.dayMin && cycleDay <= phase.dayMax) return phase;
    }
    return PHASES[PHASES.length - 1];
  }

  function getPhaseForDate(date) {
    const cycleDay = getCycleDay(date);
    return cycleDay ? getPhaseForCycleDay(cycleDay) : null;
  }

  function renderPhaseHTML(phase, cycleDay) {
    if (!phase) {
      return '<p class="phase-unknown">Upload cycle data to see your phase for this day.</p>';
    }
    let html = '<p class="phase-name">' + phase.name + '</p>';
    if (cycleDay) html += '<p class="phase-days">Cycle day ' + cycleDay + ' · ' + phase.days + '</p>';
    html += '<dl>';
    html += '<dt>Hormones</dt><dd>' + phase.hormones + '</dd>';
    html += '<dt>Mood</dt><dd>' + phase.mood + '</dd>';
    html += '<dt>Food focus</dt><dd>' + phase.food + '</dd>';
    html += '<dt>Exercise</dt><dd>' + phase.exercise + '</dd>';
    html += '</dl>';
    return html;
  }

  function updatePhaseToday() {
    const container = document.getElementById('phase-today-content');
    if (!container) return;
    const today = new Date();
    const cycleDay = getCycleDay(today);
    const phase = getPhaseForCycleDay(cycleDay);
    container.innerHTML = renderPhaseHTML(phase, cycleDay);
  }

  function parseCSV(text) {
    const rows = [];
    const lines = text.trim().split(/\r?\n/);
    for (const line of lines) {
      const cells = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cells.some(Boolean)) rows.push(cells);
    }
    return rows;
  }

  function parseDate(str) {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function addPeriodsFromCSV(rows) {
    const added = [];
    const headers = rows[0].map(h => (h || '').toLowerCase());
    const dateCol = headers.findIndex(h => h.includes('date') || h === 'start' || h === 'start_date');
    const endCol = headers.findIndex(h => h.includes('end') || h === 'end_date');
    const typeCol = headers.findIndex(h => h.includes('type') || h === 'event' || h === 'phase');

    if (rows.length < 2) return added;

    if (dateCol >= 0 && endCol >= 0) {
      for (let i = 1; i < rows.length; i++) {
        const start = parseDate(rows[i][dateCol]);
        const end = parseDate(rows[i][endCol]);
        if (start && end) {
          added.push({ start, end });
        }
      }
    } else if (dateCol >= 0) {
      let periodStart = null;
      for (let i = 1; i < rows.length; i++) {
        const date = parseDate(rows[i][dateCol]);
        if (!date) continue;
        const type = typeCol >= 0 ? (rows[i][typeCol] || '').toLowerCase() : '';
        if (type.includes('start') || type === 'period' || type === 'menstruation') {
          if (periodStart) added.push({ start: periodStart, end: new Date(periodStart.getTime()) });
          periodStart = date;
        } else if ((type.includes('end') || type === 'period_end') && periodStart) {
          added.push({ start: periodStart, end: date });
          periodStart = null;
        } else if (!periodStart) {
          periodStart = date;
        } else {
          added.push({ start: periodStart, end: date });
          periodStart = date;
        }
      }
      if (periodStart) added.push({ start: periodStart, end: new Date(periodStart.getTime()) });
    }

    state.periods.push(...added);
    state.periods.sort((a, b) => a.start - b.start);
    saveState();
    return added;
  }

  function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('calendar-month-label');
    if (!grid || !label) return;

    const y = state.viewDate.getFullYear();
    const m = state.viewDate.getMonth();
    label.textContent = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    let startDow = first.getDay();
    const daysInMonth = last.getDate();
    const prevMonth = new Date(y, m, 0);
    const prevDays = prevMonth.getDate();

    grid.innerHTML = '';
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekdays.forEach(w => {
      const th = document.createElement('div');
      th.setAttribute('role', 'columnheader');
      th.textContent = w;
      grid.appendChild(th);
    });

    let dayCount = 1;
    let nextMonthDay = 1;
    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.setAttribute('role', 'gridcell');
      cell.className = 'calendar-day';

      let date;
      if (i < startDow) {
        date = new Date(y, m - 1, prevDays - startDow + i + 1);
        cell.classList.add('other-month');
        cell.textContent = date.getDate();
      } else if (dayCount <= daysInMonth) {
        date = new Date(y, m, dayCount);
        cell.textContent = dayCount;
        dayCount++;
      } else {
        date = new Date(y, m + 1, nextMonthDay);
        cell.classList.add('other-month');
        cell.textContent = nextMonthDay;
        nextMonthDay++;
      }

      const key = formatDateKey(date);
      if (isPeriodDay(date)) cell.classList.add('period');
      if (state.focusDays[key]) cell.classList.add('focus');
      const today = new Date();
      if (formatDateKey(today) === key) cell.classList.add('today');

      cell.dataset.date = key;
      cell.addEventListener('click', () => openDayDetail(date));
      grid.appendChild(cell);
    }
  }

  function openDayDetail(date) {
    const panel = document.getElementById('day-detail');
    const dateEl = document.getElementById('day-detail-date');
    const phaseEl = document.getElementById('day-detail-phase');
    const focusCheck = document.getElementById('high-focus-day');
    const calLink = document.getElementById('add-to-calendar-link');
    if (!panel || !dateEl || !focusCheck || !calLink) return;

    const key = formatDateKey(date);
    panel.classList.remove('hidden');
    dateEl.textContent = new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const cycleDay = getCycleDay(date);
    const phase = getPhaseForCycleDay(cycleDay);
    if (phaseEl) phaseEl.innerHTML = renderPhaseHTML(phase, cycleDay);

    focusCheck.checked = !!state.focusDays[key];

    focusCheck.onchange = function () {
      if (focusCheck.checked) state.focusDays[key] = true;
      else delete state.focusDays[key];
      saveState();
      renderCalendar();
      updateAddToCalendarLink(date, calLink);
    };

    updateAddToCalendarLink(date, calLink);
    calLink.classList.toggle('hidden', !focusCheck.checked);
  }

  function updateAddToCalendarLink(date, linkEl) {
    const key = formatDateKey(date);
    if (!state.focusDays[key]) {
      linkEl.classList.add('hidden');
      return;
    }
    linkEl.classList.remove('hidden');
    const start = new Date(date);
    start.setHours(9, 0, 0, 0);
    const end = new Date(date);
    end.setHours(17, 0, 0, 0);
    const format = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=High+focus+day&dates=' + format(start) + '/' + format(end);
    linkEl.href = url;
  }

  function updateInsights() {
    const avgEl = document.getElementById('insights-avg-cycle');
    const lutealEl = document.getElementById('insights-luteal');
    if (!avgEl || !lutealEl) return;

    if (state.periods.length < 2) {
      avgEl.textContent = 'Average cycle length: — (upload CSV with at least 2 cycles)';
      lutealEl.textContent = 'Luteal phase note: —';
      return;
    }

    const lengths = [];
    for (let i = 1; i < state.periods.length; i++) {
      const prevEnd = state.periods[i - 1].end.getTime();
      const nextStart = state.periods[i].start.getTime();
      const days = Math.round((nextStart - prevEnd) / (24 * 60 * 60 * 1000));
      if (days > 0 && days < 60) lengths.push(days);
    }

    if (lengths.length === 0) {
      avgEl.textContent = 'Average cycle length: —';
    } else {
      const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
      avgEl.textContent = 'Average cycle length: ~' + avg + '-day cycle';
    }

    lutealEl.textContent = 'Luteal phase correlates with ~20% less content output for many people. Track focus days to see your pattern.';
  }

  function showCSVStatus(message, isError) {
    const el = document.getElementById('csv-status');
    if (!el) return;
    el.textContent = message;
    el.className = 'status' + (isError ? ' error' : ' success');
  }

  function addLastPeriodDate(dateStr) {
    if (!dateStr) return;
    const start = parseDate(dateStr);
    if (!start) {
      showCSVStatus('Please enter a valid date.', true);
      return;
    }
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    state.periods.push({ start, end });
    state.periods.sort((a, b) => a.start - b.start);
    saveState();
    showCSVStatus('Last period added. Phase and calendar are estimated from this date.', false);
    renderCalendar();
    updateInsights();
    updatePhaseToday();
  }

  function initLastPeriod() {
    const input = document.getElementById('last-period-date');
    const btn = document.getElementById('add-last-period-btn');
    if (!input || !btn) return;
    btn.addEventListener('click', () => {
      addLastPeriodDate(input.value);
    });
  }

  function initUpload() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('csv-input');
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file && file.name.toLowerCase().endsWith('.csv')) handleFile(file);
    });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) handleFile(file);
      input.value = '';
    });

    function handleFile(file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const rows = parseCSV(reader.result);
          const added = addPeriodsFromCSV(rows);
          showCSVStatus('Parsed ' + added.length + ' period(s). Calendar updated.', false);
          renderCalendar();
          updateInsights();
          updatePhaseToday();
        } catch (err) {
          showCSVStatus('Could not parse CSV: ' + err.message, true);
        }
      };
      reader.onerror = () => showCSVStatus('Failed to read file.', true);
      reader.readAsText(file, 'UTF-8');
    }
  }

  function initNavigation() {
    const prev = document.getElementById('prev-month');
    const next = document.getElementById('next-month');
    if (prev) prev.addEventListener('click', () => { state.viewDate.setMonth(state.viewDate.getMonth() - 1); renderCalendar(); });
    if (next) next.addEventListener('click', () => { state.viewDate.setMonth(state.viewDate.getMonth() + 1); renderCalendar(); });
  }

  loadState();
  renderCalendar();
  updateInsights();
  updatePhaseToday();
  initUpload();
  initLastPeriod();
  initNavigation();
})();
