<script>
  import { onMount } from "svelte";
  import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
  } from "firebase/firestore";
  import { db } from "../services/firebase";
  import { authStore } from "../../stores/auth";
  import { translations } from "../i18n/translations";
  import { language } from "../../stores/language";

  $: t = translations[$language].EmployeeOverview;
  $: userId = $authStore.userData?.id;
  $: userName = $authStore.userData?.name;

  let mounted = false;
  let loading = false;
  let todayAttendance = null;
  let monthlyStats = { present: 0, late: 0, total: 0, rate: 0 };

  onMount(() => {
    mounted = true;
    if (userId) {
      loadTodayAttendance();
      loadMonthlyStats();
    }
  });

  $: if (mounted && userId) {
    loadTodayAttendance();
    loadMonthlyStats();
  }

  // Load today's attendance from subcollection presence
  async function loadTodayAttendance() {
    if (!userId) return;
    loading = true;
    try {
      // Format date as "d-M-yyyy" to match document ID (e.g., "11-11-2025")
      const now = new Date();
      const docId = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;

      // Reference to specific document: pegawai/{userId}/presence/{docId}
      const presenceRef = doc(db, "pegawai", userId, "presence", docId);
      const presenceDoc = await getDoc(presenceRef);

      if (presenceDoc.exists()) {
        todayAttendance = presenceDoc.data();
      } else {
        todayAttendance = null;
      }
    } catch (error) {
      console.error("Error loading today's attendance:", error);
    } finally {
      loading = false;
    }
  }

  // Load monthly attendance stats
  async function loadMonthlyStats() {
    if (!userId) return;
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Get all presence documents for the current month
      const presenceRef = collection(db, "pegawai", userId, "presence");
      const snapshot = await getDocs(presenceRef);

      let present = 0;
      let late = 0;

      snapshot.docs.forEach((docSnap) => {
        const docId = docSnap.id; // Format: "d-M-yyyy"
        const parts = docId.split("-");

        if (parts.length === 3) {
          const docMonth = parseInt(parts[1]);
          const docYear = parseInt(parts[2]);

          // Check if document is from current month and year
          if (docMonth === currentMonth && docYear === currentYear) {
            const data = docSnap.data();

            // Check if there's a check-in (masuk field exists)
            if (data.masuk && data.masuk.date) {
              present++;

              // Check if late (after 9:00 AM)
              const checkInTime = data.masuk.date.toDate();
              const checkInHour = checkInTime.getHours();
              const checkInMinute = checkInTime.getMinutes();
              if (checkInHour > 9 || (checkInHour === 9 && checkInMinute > 0)) {
                late++;
              }
            }
          }
        }
      });

      // Calculate work days in current month
      const workDays = new Date(currentYear, currentMonth, 0).getDate();
      const attendanceRate =
        workDays > 0 ? Math.round((present / workDays) * 100) : 0;

      monthlyStats = { present, late, total: workDays, rate: attendanceRate };
    } catch (error) {
      console.error("Error loading monthly stats:", error);
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) return "-";

    // Handle Firestore Timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

    return date.toLocaleTimeString($language === "id" ? "id-ID" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<svelte:head>
  <style>
    @keyframes slideInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .animate-slide-in-up {
      animation: slideInUp 0.4s ease-out forwards;
    }
    .delay-100 {
      animation-delay: 0.1s;
    }
    .delay-200 {
      animation-delay: 0.2s;
    }
    .delay-300 {
      animation-delay: 0.3s;
    }
    .delay-400 {
      animation-delay: 0.4s;
    }
    .skeleton {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: loading 1.5s ease-in-out infinite;
    }
    @keyframes loading {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
  </style>
</svelte:head>

<!-- Welcome Card -->
<div
  class="bg-linear-to-r from-[#1A4786] via-[#2563A8] to-[#3A7AE0] rounded-3xl shadow-xl p-8 text-white relative overflow-hidden {mounted
    ? 'animate-slide-in-up delay-100'
    : 'opacity-0'}"
>
  <!-- Animated background elements -->
  <div
    class="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 animate-pulse"
    style="animation-duration: 4s;"
  ></div>
  <div
    class="absolute bottom-0 left-0 w-64 h-64 bg-[#FFD700]/20 rounded-full -ml-32 -mb-32 animate-pulse"
    style="animation-duration: 6s;"
  ></div>
  <div
    class="absolute top-1/2 right-1/4 w-32 h-32 bg-white/5 rounded-full animate-pulse"
    style="animation-duration: 5s;"
  ></div>

  <div class="relative z-10">
    <div class="flex items-center gap-4 mb-4">
      <div
        class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center ring-4 ring-white/10"
      >
        <svg
          class="w-9 h-9 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </div>
      <div>
        <p class="text-blue-100 text-sm font-medium mb-1">{t.welcomeBack}</p>
        <h1 class="text-3xl font-black">{userName || "Employee"}</h1>
      </div>
    </div>

    <!-- Current date/time display -->
    <div
      class="mt-6 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 w-fit"
    >
      <svg
        class="w-5 h-5 text-[#FFD700]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <span class="text-sm font-semibold">
        {new Date().toLocaleDateString($language === "id" ? "id-ID" : "en-US", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </span>
    </div>
  </div>
</div>

<!-- Today's Attendance Card -->
<div
  class="bg-white rounded-3xl shadow-lg border-2 border-gray-100 p-8 {mounted
    ? 'animate-slide-in-up delay-200'
    : 'opacity-0'}"
>
  <div class="flex items-center justify-between mb-8">
    <h2 class="text-2xl font-black text-[#1A4786]">{t.todayAttendance}</h2>
    <diva
      class="flex items-center gap-2 text-sm font-semibold text-gray-600 bg-gray-100 px-4 py-2 rounded-xl"
    >
      <svg
        class="w-5 h-5 text-[#3A7AE0]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {new Date().toLocaleTimeString($language === "id" ? "id-ID" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </diva>
  </div>

  {#if loading}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="skeleton rounded-2xl h-48"></div>
      <div class="skeleton rounded-2xl h-48"></div>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Check In Card -->
      <div
        class="bg-linear-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border-2 border-[#3A7AE0] relative overflow-hidden group hover:shadow-xl transition-all duration-300"
      >
        <div
          class="absolute top-0 right-0 w-40 h-40 bg-[#3A7AE0]/10 rounded-full -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-500"
        ></div>

        <div class="relative z-10">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <div
                class="w-14 h-14 bg-linear-to-br from-[#3A7AE0] to-[#1A4786] rounded-xl flex items-center justify-center shadow-lg"
              >
                <svg
                  class="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
              </div>
              <span class="text-base font-bold text-[#1A4786]">{t.checkIn}</span
              >
            </div>

            {#if todayAttendance?.masuk}
              <div
                class="flex items-center gap-2 bg-green-100 px-3 py-1.5 rounded-full"
              >
                <div
                  class="w-2 h-2 rounded-full bg-green-500 animate-pulse"
                ></div>
                <span class="text-xs font-bold text-green-700"
                  >{t.statusCheckedIn}</span
                >
              </div>
            {:else}
              <div
                class="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full"
              >
                <div class="w-2 h-2 rounded-full bg-gray-400"></div>
                <span class="text-xs font-bold text-gray-600">{t.pending}</span>
              </div>
            {/if}
          </div>

          <div class="text-5xl font-black text-[#1A4786] mb-3 tracking-tight">
            {formatTime(todayAttendance?.masuk?.date) || "--:--"}
          </div>

          {#if todayAttendance?.masuk}
            <p class="text-sm text-gray-600 font-medium">
              Checked in at {todayAttendance.location || "Office"}
            </p>
          {:else}
            <p class="text-sm text-gray-500 font-medium italic">
              {t.notCheckedIn}
            </p>
          {/if}
        </div>
      </div>

      <!-- Check Out Card -->
      <div
        class="bg-linear-to-br from-yellow-50 to-yellow-100 rounded-2xl p-8 border-2 border-yellow-400 relative overflow-hidden group hover:shadow-xl transition-all duration-300"
      >
        <div
          class="absolute top-0 right-0 w-40 h-40 bg-yellow-400/10 rounded-full -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-500"
        ></div>

        <div class="relative z-10">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <div
                class="w-14 h-14 bg-linear-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg"
              >
                <svg
                  class="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </div>
              <span class="text-base font-bold text-yellow-900"
                >{t.checkOut}</span
              >
            </div>

            {#if todayAttendance?.keluar}
              <div
                class="flex items-center gap-2 bg-yellow-100 px-3 py-1.5 rounded-full"
              >
                <div
                  class="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"
                ></div>
                <span class="text-xs font-bold text-yellow-700"
                  >{t.statusCheckedOut}</span
                >
              </div>
            {:else}
              <div
                class="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full"
              >
                <div class="w-2 h-2 rounded-full bg-gray-400"></div>
                <span class="text-xs font-bold text-gray-600">{t.pending}</span>
              </div>
            {/if}
          </div>

          <div class="text-5xl font-black text-green-900 mb-3 tracking-tight">
            {formatTime(todayAttendance?.keluar?.date) || "--:--"}
          </div>

          {#if todayAttendance?.keluar}
            <p class="text-sm text-gray-600 font-medium">
              Checked out at {todayAttendance.location || "Office"}
            </p>
          {:else}
            <p class="text-sm text-gray-500 font-medium italic">
              {t.notCheckedOut}
            </p>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Monthly Stats -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
  {#if loading}
    <div class="skeleton rounded-2xl h-40"></div>
    <div class="skeleton rounded-2xl h-40"></div>
    <div class="skeleton rounded-2xl h-40"></div>
  {:else}
    <div
      class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all {mounted
        ? 'animate-slide-in-up delay-200'
        : 'opacity-0'}"
    >
      <div class="flex items-center justify-between mb-4">
        <div
          class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center"
        >
          <svg
            class="w-6 h-6 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>
      <div class="text-sm font-medium text-gray-600 mb-2">{t.daysPresent}</div>
      <div class="text-4xl font-bold text-gray-900 mb-1">
        {monthlyStats.present}
      </div>
      <div class="text-xs text-gray-500">{t.thisMonth}</div>
    </div>

    <div
      class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all {mounted
        ? 'animate-slide-in-up delay-300'
        : 'opacity-0'}"
    >
      <div class="flex items-center justify-between mb-4">
        <div
          class="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center"
        >
          <svg
            class="w-6 h-6 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>
      <div class="text-sm font-medium text-gray-600 mb-2">{t.lateArrivals}</div>
      <div class="text-4xl font-bold text-amber-600 mb-1">
        {monthlyStats.late}
      </div>
      <div class="text-xs text-gray-500">{t.thisMonth}</div>
    </div>

    <div
      class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all {mounted
        ? 'animate-slide-in-up delay-400'
        : 'opacity-0'}"
    >
      <div class="flex items-center justify-between mb-4">
        <div
          class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center"
        >
          <svg
            class="w-6 h-6 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
      </div>
      <div class="text-sm font-medium text-gray-600 mb-2">
        {t.attendanceRate}
      </div>
      <div class="text-4xl font-bold text-green-600 mb-1">
        {monthlyStats.total > 0
          ? Math.round((monthlyStats.present / monthlyStats.total) * 100)
          : 0}%
      </div>
      <div class="text-xs text-gray-500">{t.thisMonth}</div>
    </div>
  {/if}
</div>
