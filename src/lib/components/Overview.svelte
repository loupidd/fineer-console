<!-- src/lib/components/Overview.svelte -->
<script>
  import { onMount } from "svelte";
  import { collection, getDocs } from "firebase/firestore";
  import { db } from "../services/firebase";

  let totalEmployees = 0;
  let presentToday = 0;
  let lateToday = 0;
  let selectedDate = new Date().toISOString().split("T")[0];
  let todayRecords = [];
  let loading = true;
  let debugInfo = "";

  onMount(() => {
    console.log("Overview component mounted");
    loadStats();
    loadTodayAttendance();
  });

  async function loadStats() {
    console.log("=== Loading Stats ===");
    try {
      const employeesSnap = await getDocs(collection(db, "pegawai"));
      totalEmployees = employeesSnap.size;
      console.log("Total employees:", totalEmployees);

      if (employeesSnap.empty) {
        debugInfo = "No employees found in database";
        console.warn(debugInfo);
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      console.log("Looking for date:", today);
      let present = 0;
      let late = 0;

      for (const empDoc of employeesSnap.docs) {
        const empData = empDoc.data();

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
      console.log("Final stats:", { totalEmployees, presentToday, lateToday });
      debugInfo = `Loaded ${totalEmployees} employees, ${presentToday} present today, ${lateToday} late`;
    } catch (error) {
      console.error("Error loading stats:", error);
      debugInfo = "Error: " + error.message;
    }
  }

  async function loadTodayAttendance() {
    console.log("=== Loading Today Attendance ===");
    loading = true;
    try {
      const employeesSnap = await getDocs(collection(db, "pegawai"));
      const records = [];

      console.log(
        "Processing",
        employeesSnap.size,
        "employees for date:",
        selectedDate
      );

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
              console.log(
                "Found record for:",
                employee.name,
                "on",
                presenceDate
              );
            }
          }
        });
      }

      todayRecords = records;
      console.log("Total records loaded:", records.length);
      debugInfo += ` | ${records.length} attendance records for ${selectedDate}`;
    } catch (error) {
      console.error("Error loading attendance:", error);
      debugInfo = "Error: " + error.message;
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
  <!-- Debug Info -->
  {#if debugInfo}
    <div
      class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800"
    >
      <strong>Debug:</strong>
      {debugInfo}
    </div>
  {/if}

  <!-- Stats Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500">Total Employees</p>
          <p class="text-3xl font-bold text-gray-900 mt-1">{totalEmployees}</p>
        </div>
        <div
          class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"
        >
          <span class="text-2xl">👥</span>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500">Present Today</p>
          <p class="text-3xl font-bold text-green-600 mt-1">{presentToday}</p>
        </div>
        <div
          class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center"
        >
          <span class="text-2xl">✓</span>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500">Late Check-ins</p>
          <p class="text-3xl font-bold text-amber-600 mt-1">{lateToday}</p>
        </div>
        <div
          class="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center"
        >
          <span class="text-2xl">⏰</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Today's Attendance -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-100">
    <div class="p-6 border-b border-gray-100">
      <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <h2 class="text-lg font-semibold text-gray-900">Today's Attendance</h2>
        <input
          type="date"
          bind:value={selectedDate}
          on:change={loadTodayAttendance}
          class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>

    <div class="p-6">
      {#if loading}
        <div class="flex flex-col items-center justify-center py-12">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"
          ></div>
          <p class="mt-4 text-gray-500">Loading attendance...</p>
        </div>
      {:else if todayRecords.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-500">No attendance records for this date</p>
          <p class="text-xs text-gray-400 mt-2">Date: {selectedDate}</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >Employee</th
                >
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >Site</th
                >
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >Check In</th
                >
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >Check Out</th
                >
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >Status</th
                >
              </tr>
            </thead>
            <tbody>
              {#each todayRecords as record}
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="py-3 px-4">
                    <div class="font-medium text-gray-900">
                      {record.employee.name}
                    </div>
                    <div class="text-sm text-gray-500">
                      {record.employee.nik || "-"}
                    </div>
                  </td>
                  <td class="py-3 px-4 text-gray-700"
                    >{record.employee.site || "-"}</td
                  >
                  <td class="py-3 px-4 text-gray-700"
                    >{formatTime(record.presence.masuk?.date)}</td
                  >
                  <td class="py-3 px-4 text-gray-700"
                    >{formatTime(record.presence.keluar?.date)}</td
                  >
                  <td class="py-3 px-4">
                    {#if isLate(record.presence.masuk?.date)}
                      <span
                        class="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full"
                        >Late</span
                      >
                    {:else}
                      <span
                        class="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full"
                        >On Time</span
                      >
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
