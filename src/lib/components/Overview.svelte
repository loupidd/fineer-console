<!-- src/lib/components/Overview.svelte -->
<script>
  import { onMount } from "svelte";
  import { collection, getDocs } from "firebase/firestore";
  import { db } from "../services/firebase";
  import { fade, fly, scale } from "svelte/transition";
  import { quintOut, cubicOut } from "svelte/easing";

  let totalEmployees = 0;
  let presentToday = 0;
  let lateToday = 0;
  let selectedDate = new Date().toISOString().split("T")[0];
  let todayRecords = [];
  let loading = true;

  onMount(() => {
    loadStats();
    loadTodayAttendance();
  });

  async function loadStats() {
    try {
      const employeesSnap = await getDocs(collection(db, "pegawai"));
      totalEmployees = employeesSnap.size;

      if (employeesSnap.empty) return;

      const today = new Date().toISOString().split("T")[0];
      let present = 0;
      let late = 0;

      for (const empDoc of employeesSnap.docs) {
        const presenceRef = collection(db, "pegawai", empDoc.id, "presence");
        const presenceSnap = await getDocs(presenceRef);

        presenceSnap.forEach((presDoc) => {
          const data = presDoc.data();
          if (data.date) {
            const presenceDate = data.date.split("T")[0];
            if (presenceDate === today) {
              present++;
              if (data.masuk && data.masuk.date) {
                const checkIn = new Date(data.masuk.date);
                if (
                  checkIn.getHours() > 8 ||
                  (checkIn.getHours() === 8 && checkIn.getMinutes() > 30)
                ) {
                  late++;
                }
              }
            }
          }
        });
      }

      presentToday = present;
      lateToday = late;
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  async function loadTodayAttendance() {
    loading = true;
    try {
      const employeesSnap = await getDocs(collection(db, "pegawai"));
      const records = [];

      for (const doc of employeesSnap.docs) {
        const employee = doc.data();
        const presenceRef = collection(db, "pegawai", doc.id, "presence");
        const presenceSnap = await getDocs(presenceRef);

        presenceSnap.forEach((presDoc) => {
          const presence = presDoc.data();
          if (presence.date) {
            const presenceDate = presence.date.split("T")[0];
            if (presenceDate === selectedDate) {
              records.push({ employee, presence });
            }
          }
        });
      }

      todayRecords = records;
    } catch (error) {
      console.error("Error loading attendance:", error);
    } finally {
      loading = false;
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function isLate(timestamp) {
    if (!timestamp) return false;
    const date = new Date(timestamp);
    return date.getHours() >= 9;
  }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
  <!-- Stats Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
    <!-- Total Employees -->
    <div
      class="stat-card group"
      style="background: linear-gradient(135deg, #1A4786 0%, #3A7AE0 100%);"
      in:fly={{ y: 20, duration: 600, delay: 0, easing: quintOut }}
    >
      <div class="flex items-center justify-between relative z-10">
        <div class="flex-1">
          <p class="text-white/90 text-sm font-medium mb-2 tracking-wide">
            Total Employees
          </p>
          <p
            class="text-white text-4xl font-bold transition-transform duration-300 group-hover:scale-105"
          >
            {totalEmployees}
          </p>
        </div>
        <div
          class="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:rotate-6 group-hover:scale-110"
        >
          <svg
            class="w-7 h-7 text-white"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </div>
      </div>
    </div>

    <!-- Present Today -->
    <div
      class="stat-card group"
      style="background: linear-gradient(135deg, #1A4786 0%, #3A7AE0 100%);"
      in:fly={{ y: 20, duration: 600, delay: 100, easing: quintOut }}
    >
      <div class="flex items-center justify-between relative z-10">
        <div class="flex-1">
          <p class="text-white/90 text-sm font-medium mb-2 tracking-wide">
            Present Today
          </p>
          <p
            class="text-white text-4xl font-bold transition-transform duration-300 group-hover:scale-105"
          >
            {presentToday}
          </p>
        </div>
        <div
          class="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:rotate-6 group-hover:scale-110"
        >
          <svg
            class="w-7 h-7 text-white"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>
    </div>

    <!-- Late Check-ins -->
    <div
      class="stat-card group"
      style="background: linear-gradient(135deg, #1A4786 0%, #3A7AE0 100%);"
      in:fly={{ y: 20, duration: 600, delay: 200, easing: quintOut }}
    >
      <div class="flex items-center justify-between relative z-10">
        <div class="flex-1">
          <p class="text-white/90 text-sm font-medium mb-2 tracking-wide">
            Late Check-ins
          </p>
          <p
            class="text-white text-4xl font-bold transition-transform duration-300 group-hover:scale-105"
          >
            {lateToday}
          </p>
        </div>
        <div
          class="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center transition-all duration-300 group-hover:bg-white/30 group-hover:rotate-6 group-hover:scale-110"
        >
          <svg
            class="w-7 h-7 text-white"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
      </div>
    </div>
  </div>

  <!-- Today's Attendance -->
  <div
    class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
    in:fly={{ y: 30, duration: 600, delay: 300, easing: quintOut }}
  >
    <div
      class="px-6 py-5 bg-[#F8F8F8] border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <h2 class="text-xl font-semibold" style="color: #1A4786;">
        Today's Attendance
      </h2>
      <input
        type="date"
        bind:value={selectedDate}
        on:change={loadTodayAttendance}
        class="px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0"
        style="color: #1A4786; focus:border-color: #3A7AE0; focus:ring-color: rgba(58, 122, 224, 0.2);"
      />
    </div>

    <div class="p-6">
      {#if loading}
        <div
          class="flex flex-col items-center justify-center py-16"
          in:fade={{ duration: 200 }}
        >
          <div class="spinner"></div>
          <p class="mt-4 text-gray-500 text-sm">Loading attendance...</p>
        </div>
      {:else if todayRecords.length === 0}
        <div
          class="flex flex-col items-center justify-center py-16"
          in:fade={{ duration: 300 }}
        >
          <svg
            class="w-16 h-16 text-gray-400 opacity-50 mb-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <p class="text-gray-500 text-sm">
            No attendance records for this date
          </p>
        </div>
      {:else}
        <div class="overflow-x-auto rounded-lg" in:fade={{ duration: 300 }}>
          <table class="w-full">
            <thead class="bg-[#F8F8F8]">
              <tr>
                <th
                  class="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider"
                  style="color: #1A4786;">Employee</th
                >
                <th
                  class="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider"
                  style="color: #1A4786;">Site</th
                >
                <th
                  class="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider"
                  style="color: #1A4786;">Check In</th
                >
                <th
                  class="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider"
                  style="color: #1A4786;">Check Out</th
                >
                <th
                  class="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider"
                  style="color: #1A4786;">Status</th
                >
              </tr>
            </thead>
            <tbody>
              {#each todayRecords as record, i (record.employee.nik || i)}
                <tr
                  class="border-b border-gray-100 transition-colors duration-200 hover:bg-[#F8F8F8]"
                  in:fly={{
                    x: -20,
                    duration: 400,
                    delay: i * 50,
                    easing: cubicOut,
                  }}
                >
                  <td class="py-4 px-4">
                    <div class="font-semibold text-gray-900">
                      {record.employee.name}
                    </div>
                    <div class="text-xs text-gray-500 mt-0.5">
                      {record.employee.nik || "-"}
                    </div>
                  </td>
                  <td class="py-4 px-4 text-sm font-medium text-gray-700"
                    >{record.employee.site || "-"}</td
                  >
                  <td class="py-4 px-4 text-sm font-medium text-gray-700"
                    >{formatTime(record.presence.masuk?.date)}</td
                  >
                  <td class="py-4 px-4 text-sm font-medium text-gray-700"
                    >{formatTime(record.presence.keluar?.date)}</td
                  >
                  <td class="py-4 px-4">
                    {#if isLate(record.presence.masuk?.date)}
                      <span
                        class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide border transition-all duration-200"
                        style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; border-color: rgba(245, 158, 11, 0.2);"
                        in:scale={{ duration: 300, easing: quintOut }}
                      >
                        Late
                      </span>
                    {:else}
                      <span
                        class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide border transition-all duration-200"
                        style="background: rgba(16, 185, 129, 0.1); color: #10b981; border-color: rgba(16, 185, 129, 0.2);"
                        in:scale={{ duration: 300, easing: quintOut }}
                      >
                        On Time
                      </span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .stat-card {
    position: relative;
    overflow: hidden;
    padding: 1.75rem;
    border-radius: 1rem;
    box-shadow:
      0 4px 6px -1px rgba(26, 71, 134, 0.12),
      0 2px 4px -1px rgba(26, 71, 134, 0.06);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .stat-card::before {
    content: "";
    position: absolute;
    top: -50%;
    right: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(
      circle,
      rgba(255, 255, 255, 0.1) 0%,
      transparent 70%
    );
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  }

  .stat-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 10px 15px -3px rgba(26, 71, 134, 0.15),
      0 4px 6px -2px rgba(26, 71, 134, 0.08);
  }

  .stat-card:hover::before {
    transform: translate(-25%, -25%);
  }

  .spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid #f8f8f8;
    border-top-color: #3a7ae0;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
