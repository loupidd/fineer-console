<script>
  import { onMount } from "svelte";
  import {
    collection,
    getDocs,
    query,
    Query,
    where,
    orderBy,
  } from "firebase/firestore";
  import { db } from "../services/firebase";

  let records = [];
  let sites = [];
  let selectedSite = "";
  let selectedMonth = getDefaultMonth();
  let loading = true;

  function getDefaultMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  onMount(() => {
    loadAttendance();
  });

  async function loadAttendance() {
    loading = true;
    try {
      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-31T23:59:59`;

      let q;
      q = collection(db, "pegawai");
      if (selectedSite) {
        q = query(collection(db, "pegawai"), where("site", "==", selectedSite));
      }

      const employeesSnap = await getDocs(q);
      const allRecords = [];
      const siteSet = new Set();

      for (const empDoc of employeesSnap.docs) {
        const employee = empDoc.data();
        if (employee.site) siteSet.add(employee.site);

        const presenceSnap = await getDocs(
          query(
            collection(db, "pegawai", empDoc.id, "presence"),
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "desc")
          )
        );

        presenceSnap.forEach((presDoc) => {
          allRecords.push({
            employee,
            ...presDoc.data(),
          });
        });
      }

      records = allRecords;
      sites = Array.from(siteSet).sort();
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

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function isLate(timestamp) {
    if (!timestamp) return false;
    return new Date(timestamp).getHours() >= 9;
  }

  function isIncomplete(record) {
    return !record.keluar;
  }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <div class="bg-white rounded-xl shadow-sm border border-gray-100">
    <div class="p-6 border-b border-gray-100">
      <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <h2 class="text-lg font-semibold text-gray-900">Attendance Records</h2>
        <div class="flex gap-2">
          <input
            type="month"
            bind:value={selectedMonth}
            on:change={loadAttendance}
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            bind:value={selectedSite}
            on:change={loadAttendance}
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Sites</option>
            {#each sites as site}
              <option value={site}>{site}</option>
            {/each}
          </select>
          <button
            on:click={loadAttendance}
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
          >
            Refresh
          </button>
        </div>
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
      {:else if records.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-500">No attendance records for this period</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >Date</th
                >
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
              {#each records as record}
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="py-3 px-4 text-gray-700"
                    >{formatDate(record.date)}</td
                  >
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
                    >{formatTime(record.masuk?.date)}</td
                  >
                  <td class="py-3 px-4 text-gray-700"
                    >{formatTime(record.keluar?.date)}</td
                  >
                  <td class="py-3 px-4">
                    {#if isIncomplete(record)}
                      <span
                        class="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full"
                        >Incomplete</span
                      >
                    {:else if isLate(record.masuk?.date)}
                      <span
                        class="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full"
                        >Late</span
                      >
                    {:else}
                      <span
                        class="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full"
                        >Complete</span
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
