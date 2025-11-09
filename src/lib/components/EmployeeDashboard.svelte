<!-- src/lib/components/EmployeeDashboard.svelte -->
<script>
  import { onMount } from "svelte";
  import { collection, getDocs, query, where } from "firebase/firestore";
  import { db } from "../services/firebase";
  import { authStore } from "../../stores/auth";

  $: userId = $authStore.userData?.id;

  let todayAttendance = null;
  let monthlyStats = {
    present: 0,
    late: 0,
    total: 0,
  };
  let loading = true;

  onMount(() => {
    loadDashboard();
  });

  async function loadDashboard() {
    loading = true;
    try {
      await Promise.all([loadTodayAttendance(), loadMonthlyStats()]);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      loading = false;
    }
  }

  async function loadTodayAttendance() {
    const today = new Date().toISOString().split("T")[0];

    const snap = await getDocs(
      query(
        collection(db, "pegawai", userId, "presence"),
        where("date", ">=", today),
        where("date", "<", today + "T23:59:59")
      )
    );

    if (!snap.empty) {
      todayAttendance = snap.docs[0].data();
    }
  }

  async function loadMonthlyStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    ).toISOString();

    const snap = await getDocs(
      query(
        collection(db, "pegawai", userId, "presence"),
        where("date", ">=", startOfMonth),
        where("date", "<=", endOfMonth)
      )
    );

    let present = 0;
    let late = 0;

    snap.forEach((doc) => {
      const data = doc.data();
      present++;

      if (data.masuk) {
        const checkIn = new Date(data.masuk.date);
        if (checkIn.getHours() >= 9) {
          late++;
        }
      }
    });

    monthlyStats = {
      present,
      late,
      total: present,
    };
  }

  function formatTime(timestamp) {
    if (!timestamp) return "Not checked in";
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
  <!-- Welcome Card -->
  <div
    class="bg-linear-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white"
  >
    <h1 class="text-2xl font-bold mb-2">Welcome back,</h1>
    <p class="text-xl">{$authStore.userData?.name || "Employee"}</p>
  </div>

  <!-- Today's Attendance Card -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Today's Attendance</h2>

    {#if loading}
      <div class="flex justify-center py-8">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"
        ></div>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-blue-50 rounded-lg p-4">
          <div class="text-sm text-blue-600 mb-1">Check In</div>
          <div class="text-2xl font-bold text-blue-900">
            {formatTime(todayAttendance?.masuk?.date)}
          </div>
          <div class="text-xs text-blue-600 mt-1">
            {todayAttendance?.masuk ? "Status: Checked In" : "Pending"}
          </div>
        </div>

        <div class="bg-green-50 rounded-lg p-4">
          <div class="text-sm text-green-600 mb-1">Check Out</div>
          <div class="text-2xl font-bold text-green-900">
            {formatTime(todayAttendance?.keluar?.date)}
          </div>
          <div class="text-xs text-green-600 mt-1">
            {todayAttendance?.keluar ? "Status: Checked Out" : "Pending"}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Monthly Stats -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="text-sm text-gray-500 mb-2">Days Present</div>
      <div class="text-3xl font-bold text-gray-900">{monthlyStats.present}</div>
      <div class="text-xs text-gray-500 mt-1">This month</div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="text-sm text-gray-500 mb-2">Late Arrivals</div>
      <div class="text-3xl font-bold text-amber-600">{monthlyStats.late}</div>
      <div class="text-xs text-gray-500 mt-1">This month</div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="text-sm text-gray-500 mb-2">Attendance Rate</div>
      <div class="text-3xl font-bold text-green-600">
        {monthlyStats.total > 0
          ? Math.round((monthlyStats.present / monthlyStats.total) * 100)
          : 0}%
      </div>
      <div class="text-xs text-gray-500 mt-1">This month</div>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        class="bg-linear-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200"
      >
        <h3 class="font-semibold text-blue-900 mb-2">Office Presence</h3>
        <p class="text-sm text-blue-700 mb-3">
          Record your attendance by checking in and out
        </p>
        <div class="text-xs text-blue-600">
          Use your mobile app to check in/out
        </div>
      </div>

      <div
        class="bg-linear-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200"
      >
        <h3 class="font-semibold text-green-900 mb-2">Submit Forms</h3>
        <p class="text-sm text-green-700 mb-3">
          Request leave or submit overtime forms
        </p>
        <div class="text-xs text-green-600">Go to Forms tab to submit</div>
      </div>
    </div>
  </div>
</div>
