<script>
  import { onMount } from "svelte";
  import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
  } from "firebase/firestore";
  import { db } from "../services/firebase";

  let selectedMonth = getDefaultMonth();
  let selectedEmployee = "all";
  let employees = [];
  let reportData = [];
  let showPreview = false;
  let loading = false;

  function getDefaultMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  onMount(() => {
    loadEmployees();
  });

  async function loadEmployees() {
    try {
      const snap = await getDocs(collection(db, "pegawai"));
      employees = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  }

  async function generateReport() {
    loading = true;
    showPreview = false;

    try {
      const [yearStr, monthStr] = selectedMonth.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);

      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-31T23:59:59`;

      const monthName = new Date(year, month - 1).toLocaleString("default", {
        month: "long",
        year: "numeric",
      });

      let employeesToProcess =
        selectedEmployee === "all"
          ? employees
          : employees.filter((e) => e.id === selectedEmployee);

      const data = [];

      for (const employee of employeesToProcess) {
        const presenceSnap = await getDocs(
          query(
            collection(db, "pegawai", employee.id, "presence"),
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "asc")
          )
        );

        presenceSnap.forEach((doc) => {
          const presence = doc.data();
          const date = new Date(presence.date).toLocaleDateString();
          const checkIn = presence.masuk
            ? new Date(presence.masuk.date).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
            : "-";
          const checkOut = presence.keluar
            ? new Date(presence.keluar.date).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
            : "-";

          const isLate =
            presence.masuk && new Date(presence.masuk.date).getHours() >= 9;
          const isIncomplete = !presence.keluar;

          let status = "On Time";
          if (isLate) status = "Late";
          if (isIncomplete) status = "Incomplete";

          data.push({
            date,
            name: employee.name,
            nik: employee.nik || "-",
            site: employee.site || "-",
            checkIn,
            checkOut,
            status,
          });
        });
      }

      reportData = data;
      showPreview = true;
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report");
    } finally {
      loading = false;
    }
  }

  function downloadCSV() {
    if (reportData.length === 0) {
      alert("Please generate a report first");
      return;
    }

    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);

    const monthName = new Date(year, month - 1).toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    // Create CSV with proper formatting
    const headers = [
      "Date",
      "Employee Name",
      "NIK",
      "Site",
      "Check In",
      "Check Out",
      "Status",
    ];
    const rows = reportData.map((row) => [
      row.date,
      row.name,
      row.nik,
      row.site,
      row.checkIn,
      row.checkOut,
      row.status,
    ]);

    // Escape and format CSV
    const csvContent = [
      [`Fineer Attendance Report - ${monthName}`],
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((cell) => {
            const cellStr = String(cell);
            if (
              cellStr.includes(",") ||
              cellStr.includes('"') ||
              cellStr.includes("\n")
            ) {
              return '"' + cellStr.replace(/"/g, '""') + '"';
            }
            return cellStr;
          })
          .join(",")
      )
      .join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Fineer_Attendance_Report_${selectedMonth}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
  <!-- Generate Report Card -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">
      Generate CSV Reports
    </h2>

    <div class="space-y-4">
      <div>
        <label for="month" class="block text-sm font-medium text-gray-700 mb-1">
          Month
        </label>
        <input
          id="month"
          type="month"
          bind:value={selectedMonth}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          for="employee"
          class="block text-sm font-medium text-gray-700 mb-1"
        >
          Employee
        </label>
        <select
          id="employee"
          bind:value={selectedEmployee}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select an employee</option>
          {#each employees as emp}
            <option value={emp.id}>{emp.name}</option>
          {/each}
        </select>
      </div>

      <button
        on:click={generateReport}
        disabled={loading}
        class="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Generating..." : "Generate Report"}
      </button>
    </div>
  </div>

  <!-- Preview Card -->
  {#if showPreview}
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      <div
        class="p-6 border-b border-gray-100 flex justify-between items-center"
      >
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Report Preview</h2>
          <p class="text-sm text-gray-500 mt-1">
            Total Records: {reportData.length}
          </p>
        </div>
        <button
          on:click={downloadCSV}
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
        >
          Download CSV
        </button>
      </div>

      <div class="p-6">
        {#if reportData.length === 0}
          <div class="text-center py-12">
            <p class="text-gray-500">
              No attendance records found for this period
            </p>
          </div>
        {:else}
          <div class="overflow-x-auto max-h-96">
            <table class="w-full">
              <thead class="sticky top-0 bg-blue-500 text-white">
                <tr>
                  <th class="text-left py-3 px-4 text-sm font-semibold">Date</th
                  >
                  <th class="text-left py-3 px-4 text-sm font-semibold"
                    >Employee Name</th
                  >
                  <th class="text-left py-3 px-4 text-sm font-semibold">NIK</th>
                  <th class="text-left py-3 px-4 text-sm font-semibold">Site</th
                  >
                  <th class="text-left py-3 px-4 text-sm font-semibold"
                    >Check In</th
                  >
                  <th class="text-left py-3 px-4 text-sm font-semibold"
                    >Check Out</th
                  >
                  <th class="text-left py-3 px-4 text-sm font-semibold"
                    >Status</th
                  >
                </tr>
              </thead>
              <tbody>
                {#each reportData as row}
                  <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-3 px-4 text-gray-700">{row.date}</td>
                    <td class="py-3 px-4 text-gray-700">{row.name}</td>
                    <td class="py-3 px-4 text-gray-700">{row.nik}</td>
                    <td class="py-3 px-4 text-gray-700">{row.site}</td>
                    <td class="py-3 px-4 text-gray-700">{row.checkIn}</td>
                    <td class="py-3 px-4 text-gray-700">{row.checkOut}</td>
                    <td class="py-3 px-4">{row.status}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
