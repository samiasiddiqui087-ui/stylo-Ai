import { useMemo, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  MapPin,
  Plus,
  Trash2,
} from 'lucide-react';
import { useImmerso } from '../context/ImmersoContext.tsx';
import { formatDateIso, formatReadableDate } from '../lib/format.ts';
import { SmartImage } from './SmartImage.tsx';

export function OutfitPlannerPage() {
  const {
    user,
    signInWithGoogle,
    schedules,
    saveSchedule,
    deleteSchedule,
    products,
    weather,
    fetchWeatherByCity,
    fetchWeatherByGeolocation,
  } = useImmerso();

  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');
  const [cursorDate, setCursorDate] = useState(new Date());
  const [selectedIso, setSelectedIso] = useState(formatDateIso(new Date()));
  const [cityInput, setCityInput] = useState(weather?.city || 'Karachi');

  const [title, setTitle] = useState('');
  const [occasion, setOccasion] = useState('Office Chic');
  const [selectedProdId, setSelectedProdId] = useState(products[0]?.id || '');
  const [accessoriesNote, setAccessoriesNote] = useState('Sculpted gold drops & structured tote');
  const [reminderEnabled, setReminderEnabled] = useState(true);

  const monthDays = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ iso: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ iso: null, dayNum: null });
    for (let d = 1; d <= totalDays; d++) {
      const dt = new Date(year, month, d);
      cells.push({ iso: formatDateIso(dt), dayNum: d });
    }
    return cells;
  }, [cursorDate]);

  const weekDays = useMemo(() => {
    const base = new Date(`${selectedIso}T12:00:00`);
    const day = base.getDay();
    const start = new Date(base);
    start.setDate(base.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(start);
      dt.setDate(start.getDate() + i);
      return { iso: formatDateIso(dt), dayNum: dt.getDate(), label: formatReadableDate(formatDateIso(dt)) };
    });
  }, [selectedIso]);

  const schedulesForSelected = schedules.filter((s) => s.date === selectedIso);

  const handleAssignOutfit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await saveSchedule({
      date: selectedIso,
      title: title.trim(),
      occasion,
      accessoriesNote,
      weatherNote: weather ? `${weather.city}: ${weather.temperatureC}°C ${weather.condition}` : '',
      productIds: selectedProdId ? [selectedProdId] : [],
      reminderEnabled,
    });
    setTitle('');
  };

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E5DDD0]">
        <div>
          <p className="text-xs text-[#70685E] mb-1">Calendar & Weather Styling</p>
          <h1 className="font-editorial text-4xl font-medium">AI Outfit Planner</h1>
        </div>

        {/* Real Weather Selector */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (cityInput.trim()) void fetchWeatherByCity(cityInput.trim());
            }}
            className="flex items-center gap-1.5 w-full sm:w-auto"
          >
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="City (e.g. Lahore)"
              className="flex-1 sm:w-36 min-w-0 px-3 py-1.5 text-xs bg-white border border-[#E5DDD0] rounded-lg"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs bg-[#F7F3EC] border border-[#E5DDD0] rounded-lg hover:bg-[#E5DDD0] shrink-0 cursor-pointer"
            >
              Update Weather
            </button>
          </form>
          <button
            onClick={() => void fetchWeatherByGeolocation()}
            title="Use current location"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-[#E5DDD0] rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5 text-[#B5945B]" />
            <span>GPS</span>
          </button>
        </div>
      </div>

      {/* Live Weather Styling Banner */}
      {weather && (
        <div className="bg-[#F7F3EC] border border-[#E5DDD0] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CloudSun className="w-6 h-6 text-[#B5945B] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">
                {weather.city}: <span className="font-mono-num">{weather.temperatureC}°C</span> · {weather.condition}
              </p>
              <p className="text-xs text-[#70685E] mt-0.5">{weather.stylingTip}</p>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto">
            {weather.dailyForecast.slice(0, 3).map((d) => (
              <div
                key={d.date}
                className="px-3 py-2 bg-white border border-[#E5DDD0] rounded-xl text-xs shrink-0"
              >
                <p className="text-[#70685E]">{formatReadableDate(d.date)}</p>
                <p className="font-mono-num font-semibold mt-0.5">
                  {d.maxC}° / {d.minC}°
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendar Left */}
        <div className="lg:col-span-8 bg-white border border-[#E5DDD0] rounded-2xl p-3.5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-[#E5DDD0]">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() =>
                  setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() - 1, 1))
                }
                className="p-2 border border-[#E5DDD0] rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="font-editorial text-xl sm:text-2xl font-medium">
                {cursorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() =>
                  setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 1))
                }
                className="p-2 border border-[#E5DDD0] rounded-lg hover:bg-[#F7F3EC] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#F7F3EC] rounded-lg">
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  viewMode === 'monthly' ? 'bg-white text-[#2A231E] shadow-xs' : 'text-[#70685E]'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  viewMode === 'weekly' ? 'bg-white text-[#2A231E] shadow-xs' : 'text-[#70685E]'
                }`}
              >
                Weekly
              </button>
            </div>
          </div>

          {viewMode === 'monthly' ? (
            <>
              <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[11px] sm:text-xs text-[#70685E] py-2.5 sm:py-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {monthDays.map((cell, idx) => {
                  if (!cell.iso) return <div key={idx} className="h-12 sm:h-20" />;
                  const daySchedules = schedules.filter((s) => s.date === cell.iso);
                  const isSelected = cell.iso === selectedIso;
                  return (
                    <button
                      key={cell.iso}
                      onClick={() => setSelectedIso(cell.iso!)}
                      className={`h-12 sm:h-20 p-1 sm:p-2 rounded-lg sm:rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#2A231E] text-[#FDFBF7] border-[#2A231E]'
                          : 'bg-[#FDFBF7] border-[#E5DDD0] hover:bg-[#F7F3EC]'
                      }`}
                    >
                      <span className="font-mono-num text-[11px] sm:text-xs font-medium">{cell.dayNum}</span>
                      {daySchedules.length > 0 && (
                        <>
                          <span
                            className={`w-1.5 h-1.5 rounded-full sm:hidden ${
                              isSelected ? 'bg-[#DFC085]' : 'bg-[#B5945B]'
                            }`}
                          />
                          <span
                            className={`hidden sm:block text-[10px] truncate ${
                              isSelected ? 'text-[#E5DDD0]' : 'text-[#B5945B] font-medium'
                            }`}
                          >
                            {daySchedules[0].title}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-3 mt-4">
              {weekDays.map((day) => {
                const daySchedules = schedules.filter((s) => s.date === day.iso);
                return (
                  <button
                    key={day.iso}
                    onClick={() => setSelectedIso(day.iso)}
                    className={`w-full p-4 rounded-xl border flex items-center justify-between text-left cursor-pointer ${
                      day.iso === selectedIso
                        ? 'bg-[#2A231E] text-[#FDFBF7] border-[#2A231E]'
                        : 'bg-[#FDFBF7] border-[#E5DDD0] hover:bg-[#F7F3EC]'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{day.label}</p>
                      <p className="text-xs opacity-80">
                        {daySchedules.length > 0
                          ? `${daySchedules[0].title} · ${daySchedules[0].occasion}`
                          : 'No outfit scheduled yet'}
                      </p>
                    </div>
                    <CalendarIcon className="w-4 h-4 opacity-75" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Date Controls Right */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 sm:p-6 space-y-4">
            <h3 className="font-editorial text-2xl font-medium">
              {formatReadableDate(selectedIso)}
            </h3>

            {schedulesForSelected.length > 0 ? (
              <div className="space-y-3">
                {schedulesForSelected.map((sch) => {
                  const linkedProd = products.find((p) => sch.productIds.includes(p.id));
                  return (
                    <div
                      key={sch.id}
                      className="p-3.5 bg-[#F7F3EC] border border-[#E5DDD0] rounded-xl space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{sch.title}</p>
                          <p className="text-xs text-[#70685E]">{sch.occasion}</p>
                        </div>
                        <button
                          onClick={() => void deleteSchedule(sch.id)}
                          aria-label="Delete schedule"
                          className="p-1 text-[#70685E] hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {linkedProd && (
                        <div className="flex items-center gap-2.5 bg-white p-2 rounded-lg border border-[#E5DDD0]">
                          <div className="w-10 h-12 rounded overflow-hidden shrink-0">
                            <SmartImage
                              src={linkedProd.images[0]}
                              alt={linkedProd.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="text-xs font-medium truncate">{linkedProd.name}</span>
                        </div>
                      )}
                      {sch.accessoriesNote && (
                        <p className="text-xs text-[#70685E]">{sch.accessoriesNote}</p>
                      )}
                      {sch.reminderEnabled && (
                        <p className="text-[11px] text-[#B5945B] flex items-center gap-1">
                          <Bell className="w-3 h-3" />
                          <span>Morning outfit reminder active</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#70685E]">
                No outfit assigned for this date yet. Schedule a look below.
              </p>
            )}

            {!user ? (
              <button
                onClick={() => void signInWithGoogle()}
                className="w-full py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg cursor-pointer"
              >
                Sign In to Save Schedules
              </button>
            ) : (
              <form onSubmit={handleAssignOutfit} className="space-y-3 pt-3 border-t border-[#E5DDD0]">
                <div>
                  <label className="block text-xs text-[#70685E] mb-1">Look Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Monday – Office Chic"
                    className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#70685E] mb-1">Occasion</label>
                  <select
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                  >
                    <option>Office Chic</option>
                    <option>Casual Minimal</option>
                    <option>Modern Classic</option>
                    <option>Elegant Evening</option>
                    <option>Wedding Soirée</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#70685E] mb-1">Featured Piece</label>
                  <select
                    value={selectedProdId}
                    onChange={(e) => setSelectedProdId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#70685E] mb-1">Accessories Note</label>
                  <input
                    type="text"
                    value={accessoriesNote}
                    onChange={(e) => setAccessoriesNote(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#E5DDD0] rounded-lg"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-[#2A231E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(e) => setReminderEnabled(e.target.checked)}
                    className="accent-[#2A231E]"
                  />
                  <span>Enable outfit reminder</span>
                </label>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-xs font-semibold rounded-lg hover:bg-[#3F352E] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Outfit</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
