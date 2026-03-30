import React, { useMemo, useState } from 'react';

const INITIAL_ROWS = [
  { id: 1, character: '매직', category: '유니폼 필요', detail: '일반', done: false },
  { id: 2, character: '제시카존스', category: '유니폼 필요', detail: '일반', done: false },
  { id: 3, character: '루크케이지', category: '유니폼 필요', detail: '일반', done: false },
  { id: 4, character: '비스트', category: '유니폼 필요', detail: '일반', done: false },
  { id: 5, character: '부두', category: '유니폼 필요', detail: '일반', done: false },
  { id: 6, character: '미판', category: '유니폼 필요', detail: '일반', done: false },
  { id: 7, character: '인우먼', category: '유니폼 필요', detail: '일반', done: false },

  { id: 8, character: '매직', category: '성장 필요', detail: '1티→2티 / 매생캐 / 고승권 필요', done: false },
  { id: 9, character: '블루드래곤', category: '성장 필요', detail: '1티→2티 / 매생캐 / 고승권 필요', done: false },
  { id: 10, character: '썬버드', category: '성장 필요', detail: '1티→2티 / 매생캐 / 고승권 필요', done: false },
  { id: 11, character: '레스큐', category: '성장 필요', detail: '1티→2티 / 매생캐 / 고승권 필요', done: false },
  { id: 12, character: '웨헥', category: '성장 필요', detail: '1티→2티 / 매생캐 / 고승권 필요', done: false },
  { id: 13, character: '에코', category: '성장 필요', detail: '1티→2티 / 매생캐 / 고승권 필요', done: false },
  { id: 14, character: '고스트', category: '성장 필요', detail: '1티→2티 / 매생캐 / 고승권 필요', done: false },
  { id: 15, character: '옐레나', category: '성장 필요', detail: '1티→2티 / 매생캐 / 고승권 필요', done: false },
  { id: 16, character: '카니지', category: '성장 필요', detail: '1티→2티 / 매생캐 / 고승권 필요', done: false },

  { id: 17, character: '워타이거', category: '성장 필요', detail: '2티→3티/각초 / 일반캐+매생캐', done: false },
  { id: 18, character: '비스트', category: '성장 필요', detail: '2티→3티/각초 / 일반캐+매생캐', done: false },
  { id: 19, character: '부두', category: '성장 필요', detail: '2티→3티/각초 / 일반캐+매생캐', done: false },

  { id: 20, character: '아담', category: '획득 필요', detail: '3티/각초→4티', done: false },
  { id: 21, character: '인우먼', category: '획득 필요', detail: '3티/각초→4티', done: false },
];

function getNextId(rows) {
  return rows.reduce((maxId, row) => Math.max(maxId, row.id), 0) + 1;
}

function filterRows(rows, query, categoryFilter, showDone) {
  const normalizedQuery = query.trim().toLowerCase();

  return rows.filter((row) => {
    const matchesQuery =
      normalizedQuery === '' ||
      row.character.toLowerCase().includes(normalizedQuery) ||
      row.category.toLowerCase().includes(normalizedQuery) ||
      row.detail.toLowerCase().includes(normalizedQuery);

    const matchesCategory = categoryFilter === '전체' || row.category === categoryFilter;
    const matchesDone = showDone || !row.done;

    return matchesQuery && matchesCategory && matchesDone;
  });
}

function groupRowsByCharacter(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.character)) map.set(row.character, []);
    map.get(row.character).push(row);
  }

  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko'));
}

function groupRowsByCategory(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = `${row.category}__${row.detail}`;
    if (!map.has(key)) {
      map.set(key, { category: row.category, detail: row.detail, items: [] });
    }
    map.get(key).items.push(row);
  }

  return Array.from(map.values()).sort((a, b) => {
    const byCategory = a.category.localeCompare(b.category, 'ko');
    return byCategory !== 0 ? byCategory : a.detail.localeCompare(b.detail, 'ko');
  });
}

function runSanityTests() {
  const sample = [
    { id: 1, character: 'A', category: '유니폼 필요', detail: '일반', done: false },
    { id: 2, character: 'A', category: '성장 필요', detail: '1티→2티', done: true },
    { id: 3, character: 'B', category: '획득 필요', detail: '4티', done: false },
  ];

  const tests = [
    {
      name: 'getNextId returns max id + 1',
      pass: getNextId(sample) === 4,
    },
    {
      name: 'filterRows hides done entries when showDone is false',
      pass: filterRows(sample, '', '전체', false).length === 2,
    },
    {
      name: 'groupRowsByCharacter groups duplicate character entries together',
      pass: groupRowsByCharacter(sample)[0][1].length === 2,
    },
    {
      name: 'groupRowsByCategory creates separate category-detail groups',
      pass: groupRowsByCategory(sample).length === 3,
    },
  ];

  return tests;
}

export default function MFFTrackerUI() {
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [view, setView] = useState('character');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [showDone, setShowDone] = useState(true);
  const [form, setForm] = useState({
    character: '',
    category: '유니폼 필요',
    detail: '',
  });

  const sanityTests = useMemo(() => runSanityTests(), []);

  const categories = useMemo(() => {
    return ['전체', ...Array.from(new Set(rows.map((row) => row.category)))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    return filterRows(rows, query, categoryFilter, showDone);
  }, [rows, query, categoryFilter, showDone]);

  const groupedByCharacter = useMemo(() => {
    return groupRowsByCharacter(filteredRows);
  }, [filteredRows]);

  const groupedByCategory = useMemo(() => {
    return groupRowsByCategory(filteredRows);
  }, [filteredRows]);

  function addRow(event) {
    event.preventDefault();

    const character = form.character.trim();
    const category = form.category.trim();
    const detail = form.detail.trim();

    if (!character || !category || !detail) return;

    setRows((prev) => [
      ...prev,
      {
        id: getNextId(prev),
        character,
        category,
        detail,
        done: false,
      },
    ]);

    setForm({ character: '', category: form.category, detail: '' });
  }

  function toggleDone(id) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, done: !row.done } : row)));
  }

  function removeRow(id) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'mff_tracker.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function resetAll() {
    setRows(INITIAL_ROWS);
    setQuery('');
    setCategoryFilter('전체');
    setShowDone(true);
    setForm({ character: '', category: '유니폼 필요', detail: '' });
  }

  const passedCount = sanityTests.filter((test) => test.pass).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl shadow-sm border p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Marvel Future Fight Tracker</h1>
              <p className="text-sm text-slate-600 mt-1">
                캐릭터별 성장/유니폼/획득 메모를 깔끔하게 관리하는 UI
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setView('character')}
                className={`px-4 py-2 rounded-2xl border ${view === 'character' ? 'bg-slate-900 text-white' : 'bg-white'}`}
              >
                Character View
              </button>
              <button
                onClick={() => setView('category')}
                className={`px-4 py-2 rounded-2xl border ${view === 'category' ? 'bg-slate-900 text-white' : 'bg-white'}`}
              >
                Category View
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border p-5 h-fit space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Add Entry</h2>
              <form onSubmit={addRow} className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Character</label>
                  <input
                    value={form.character}
                    onChange={(event) => setForm({ ...form, character: event.target.value })}
                    placeholder="예: 샤론 로저스"
                    className="w-full mt-1 px-3 py-2 rounded-2xl border"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-2xl border"
                  >
                    <option>유니폼 필요</option>
                    <option>성장 필요</option>
                    <option>획득 필요</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Detail</label>
                  <input
                    value={form.detail}
                    onChange={(event) => setForm({ ...form, detail: event.target.value })}
                    placeholder="예: 일반 / 1티→2티 / 매생캐"
                    className="w-full mt-1 px-3 py-2 rounded-2xl border"
                  />
                </div>
                <button className="w-full px-4 py-2 rounded-2xl bg-slate-900 text-white font-medium">
                  Add
                </button>
              </form>
            </div>

            <div className="pt-6 border-t space-y-3">
              <h2 className="text-xl font-semibold">Filters</h2>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search character/category/detail"
                className="w-full px-3 py-2 rounded-2xl border"
              />
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="w-full px-3 py-2 rounded-2xl border"
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showDone}
                  onChange={(event) => setShowDone(event.target.checked)}
                />
                Show completed entries
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={exportJson} className="flex-1 px-4 py-2 rounded-2xl border">
                  Export JSON
                </button>
                <button type="button" onClick={resetAll} className="flex-1 px-4 py-2 rounded-2xl border">
                  Reset
                </button>
              </div>
            </div>

            <div className="pt-6 border-t space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Sanity Tests</h2>
                <span className="text-sm text-slate-500">{passedCount}/{sanityTests.length} passed</span>
              </div>
              <div className="space-y-2">
                {sanityTests.map((test) => (
                  <div
                    key={test.name}
                    className={`rounded-2xl border px-3 py-2 text-sm ${test.pass ? 'bg-green-50' : 'bg-red-50'}`}
                  >
                    <span className="font-medium">{test.pass ? 'PASS' : 'FAIL'}</span> — {test.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {view === 'character' ? 'Grouped by Character' : 'Grouped by Category'}
              </h2>
              <div className="text-sm text-slate-500">{filteredRows.length} entries</div>
            </div>

            {view === 'character' ? (
              <div className="space-y-4">
                {groupedByCharacter.map(([character, items]) => (
                  <div key={character} className="rounded-3xl border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold">{character}</h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100">{items.length} items</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-2xl border px-3 py-2"
                        >
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => toggleDone(item.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium ${item.done ? 'line-through text-slate-400' : ''}`}>
                              {item.category}
                            </div>
                            <div className={`text-sm text-slate-600 ${item.done ? 'line-through text-slate-400' : ''}`}>
                              {item.detail}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRow(item.id)}
                            className="text-sm px-3 py-1 rounded-xl border"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {groupedByCategory.map((group) => (
                  <div key={`${group.category}-${group.detail}`} className="rounded-3xl border p-4">
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold">{group.category}</h3>
                      <p className="text-sm text-slate-600">{group.detail}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.items
                        .slice()
                        .sort((a, b) => a.character.localeCompare(b.character, 'ko'))
                        .map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-2xl border ${item.done ? 'opacity-50' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={() => toggleDone(item.id)}
                            />
                            <span className={item.done ? 'line-through' : ''}>{item.character}</span>
                            <button
                              type="button"
                              onClick={() => removeRow(item.id)}
                              className="text-xs px-2 py-1 rounded-xl border"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
