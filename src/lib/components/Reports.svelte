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
  import { fade, fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { translations } from "../i18n/translations";

  import { language } from "../../stores/language";

  $: t = translations[$language].Reports;

  let reportType = "monthly";
  let selectedDate = new Date().toISOString().split("T")[0];
  let selectedMonth = getDefaultMonth();
  let selectedYear = new Date().getFullYear().toString();
  let selectedEmployee = "all";

  // New variables for custom date range
  let reportStartDate = "";
  let reportEndDate = "";

  let employees = [];
  let reportData = [];
  let showPreview = false;
  let loading = false;

  function getDefaultMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  // Initialize default date range (21st of last month to 20th of current month)
  function initializeDefaultDateRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 21);
    const end = new Date(now.getFullYear(), now.getMonth(), 20);
    reportStartDate = start.toISOString().split("T")[0];
    reportEndDate = end.toISOString().split("T")[0];
  }

  onMount(() => {
    loadEmployees();
    initializeDefaultDateRange();
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
      let startDate, endDate, periodName;

      if (reportType === "daily") {
        startDate = selectedDate;
        endDate = `${selectedDate}T23:59:59`;
        periodName = new Date(selectedDate).toLocaleDateString(
          $language === "id" ? "id-ID" : "en-US",
          { year: "numeric", month: "long", day: "numeric" }
        );
      } else if (reportType === "monthly") {
        // Use custom date range
        startDate = reportStartDate;
        endDate = `${reportEndDate}T23:59:59`;
        const start = new Date(reportStartDate);
        const end = new Date(reportEndDate);
        periodName = `${start.toLocaleDateString($language === "id" ? "id-ID" : "en-US", { year: "numeric", month: "long", day: "numeric" })} - ${end.toLocaleDateString($language === "id" ? "id-ID" : "en-US", { year: "numeric", month: "long", day: "numeric" })}`;
      } else {
        // yearly
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31T23:59:59`;
        periodName = selectedYear;
      }

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
          const date = new Date(presence.date).toLocaleDateString(
            $language === "id" ? "id-ID" : "en-US"
          );
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

          let status = t.onTime;
          if (isLate) status = t.late;
          if (isIncomplete) status = t.incomplete;

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
      alert(t.pleaseGenerate);
      return;
    }

    let periodName;
    if (reportType === "daily") {
      periodName = new Date(selectedDate).toLocaleDateString(
        $language === "id" ? "id-ID" : "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      );
    } else if (reportType === "monthly") {
      const start = new Date(reportStartDate);
      const end = new Date(reportEndDate);
      periodName = `${start.toLocaleDateString($language === "id" ? "id-ID" : "en-US", { year: "numeric", month: "short", day: "numeric" })}_to_${end.toLocaleDateString($language === "id" ? "id-ID" : "en-US", { year: "numeric", month: "short", day: "numeric" })}`;
    } else {
      periodName = selectedYear;
    }

    const headers = [
      t.date,
      t.employeeName,
      t.nik,
      t.site,
      t.checkIn,
      t.checkOut,
      t.status,
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

    const csvContent = [[`Attendance Report - ${periodName}`], headers, ...rows]
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

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    const filename = `Attendance_Report_${reportType}_${periodName.replace(/\s+/g, "_")}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getYears() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i.toString());
    }
    return years;
  }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
  <!-- Header -->
  <div
    class="bg-linear-to-r from-[#1A4786] to-[#3A7AE0] rounded-2xl shadow-lg p-8 text-white relative overflow-hidden"
    in:fly={{ y: 20, duration: 600, easing: quintOut }}
  >
    <div
      class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"
    ></div>
    <div
      class="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24"
    ></div>

    <div class="relative z-10">
      <div class="flex items-center gap-3">
        <div
          class="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center"
        >
          <svg
            class="w-6 h-6 text-[#FFD700]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div>
          <h1 class="text-2xl font-bold">{t.title}</h1>
          <p class="text-sm text-white/80">{t.subtitle}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Generate Report Card -->
  <div
    class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
    in:fly={{ y: 20, duration: 600, delay: 100, easing: quintOut }}
  >
    <div class="space-y-6">
      <!-- Report Type -->
      <div class="input-focus-ring">
        <label
          for="reportType"
          class="block text-sm font-semibold text-[#1A4786] mb-2"
        >
          {t.reportType}
        </label>
        <select
          id="reportType"
          bind:value={reportType}
          class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium appearance-none"
        >
          <option value="daily">{t.daily}</option>
          <option value="monthly">{t.monthly}</option>
          <option value="yearly">{t.yearly}</option>
        </select>
      </div>

      <!-- Date Selection -->
      {#if reportType === "daily"}
        <div class="input-focus-ring" in:fade={{ duration: 200 }}>
          <label
            for="date"
            class="block text-sm font-semibold text-[#1A4786] mb-2"
          >
            {t.selectDate}
          </label>
          <input
            id="date"
            type="date"
            bind:value={selectedDate}
            class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium"
          />
        </div>
      {:else if reportType === "monthly"}
        <div in:fade={{ duration: 200 }}>
          <!-- Info Box -->
          <div
            class="p-3 bg-blue-50 border-l-4 border-[#3A7AE0] rounded-lg mb-4"
          >
            <p class="text-xs text-[#1A4786]">
              {$language === "id"
                ? "💡 Secara default: Tanggal 21 bulan lalu sampai tanggal 20 bulan ini"
                : "💡 Default: 21st of last month to 20th of current month"}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="input-focus-ring">
              <label
                for="report-start-date"
                class="block text-sm font-semibold text-[#1A4786] mb-2"
              >
                {$language === "id" ? "Tanggal Mulai" : "Start Date"}
              </label>
              <input
                id="report-start-date"
                type="date"
                bind:value={reportStartDate}
                class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300"
              />
            </div>

            <div class="input-focus-ring">
              <label
                for="report-end-date"
                class="block text-sm font-semibold text-[#1A4786] mb-2"
              >
                {$language === "id" ? "Tanggal Selesai" : "End Date"}
              </label>
              <input
                id="report-end-date"
                type="date"
                bind:value={reportEndDate}
                class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300"
              />
            </div>
          </div>
        </div>
      {:else}
        <div class="input-focus-ring" in:fade={{ duration: 200 }}>
          <label
            for="year"
            class="block text-sm font-semibold text-[#1A4786] mb-2"
          >
            {t.selectYear}
          </label>
          <select
            id="year"
            bind:value={selectedYear}
            class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium appearance-none"
          >
            {#each getYears() as year}
              <option value={year}>{year}</option>
            {/each}
          </select>
        </div>
      {/if}

      <!-- Employee Selection -->
      <div class="input-focus-ring">
        <label
          for="employee"
          class="block text-sm font-semibold text-[#1A4786] mb-2"
        >
          {t.employee}
        </label>
        <select
          id="employee"
          bind:value={selectedEmployee}
          class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium appearance-none"
        >
          <option value="all">{t.allEmployees}</option>
          {#each employees as emp}
            <option value={emp.id}>{emp.name}</option>
          {/each}
        </select>
      </div>

      <!-- Generate Button -->
      <button
        on:click={generateReport}
        disabled={loading ||
          (reportType === "monthly" && (!reportStartDate || !reportEndDate))}
        class="w-full px-6 py-4 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
      >
        {#if loading}
          <div class="flex items-center justify-center gap-2">
            <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>{t.generating}</span>
          </div>
        {:else}
          <div class="flex items-center justify-center gap-2">
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>{t.generate}</span>
          </div>
        {/if}
      </button>
    </div>
  </div>

  <!-- Preview Card -->
  {#if showPreview}
    <div
      class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      in:fly={{ y: 20, duration: 600, easing: quintOut }}
    >
      <div
        class="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-[#F8F8F8]"
      >
        <div>
          <h2 class="text-xl font-semibold text-[#1A4786]">{t.preview}</h2>
          <p class="text-sm text-gray-600 mt-1">
            {t.totalRecords}:
            <span class="font-semibold text-[#3A7AE0]">{reportData.length}</span
            >
          </p>
        </div>
        <button
          on:click={downloadCSV}
          class="px-6 py-3 bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-lg flex items-center gap-2"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {t.download}
        </button>
      </div>

      <div class="p-6">
        {#if reportData.length === 0}
          <div class="text-center py-16" in:fade={{ duration: 300 }}>
            <svg
              class="w-16 h-16 text-gray-400 opacity-50 mb-4 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p class="text-gray-500">{t.noRecords}</p>
          </div>
        {:else}
          <div
            class="overflow-x-auto rounded-lg max-h-[500px] overflow-y-auto"
            in:fade={{ duration: 300 }}
          >
            <table class="w-full">
              <thead
                class="sticky top-0 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white"
              >
                <tr>
                  <th
                    class="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider"
                    >{t.date}</th
                  >
                  <th
                    class="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider"
                    >{t.employeeName}</th
                  >
                  <th
                    class="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider"
                    >{t.nik}</th
                  >
                  <th
                    class="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider"
                    >{t.site}</th
                  >
                  <th
                    class="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider"
                    >{t.checkIn}</th
                  >
                  <th
                    class="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider"
                    >{t.checkOut}</th
                  >
                  <th
                    class="text-left py-4 px-4 text-xs font-semibold uppercase tracking-wider"
                    >{t.status}</th
                  >
                </tr>
              </thead>
              <tbody>
                {#each reportData as row, i}
                  <tr
                    class="border-b border-gray-100 hover:bg-[#F8F8F8] transition-colors"
                  >
                    <td class="py-4 px-4 text-sm text-gray-700 font-medium"
                      >{row.date}</td
                    >
                    <td class="py-4 px-4 text-sm text-gray-700 font-medium"
                      >{row.name}</td
                    >
                    <td class="py-4 px-4 text-sm text-gray-600">{row.nik}</td>
                    <td class="py-4 px-4 text-sm text-gray-600">{row.site}</td>
                    <td class="py-4 px-4 text-sm text-gray-700"
                      >{row.checkIn}</td
                    >
                    <td class="py-4 px-4 text-sm text-gray-700"
                      >{row.checkOut}</td
                    >
                    <td class="py-4 px-4">
                      <span
                        class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide border transition-all"
                        class:bg-green-status={row.status === t.onTime}
                        class:bg-warning-status={row.status === t.late}
                        class:bg-gray-status={row.status === t.incomplete}
                      >
                        {row.status}
                      </span>
                    </td>
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

<style>
  .input-focus-ring {
    transition: all 0.2s ease;
  }

  .input-focus-ring:focus-within {
    transform: translateY(-2px);
  }

  .bg-green-status {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.2);
  }

  .bg-warning-status {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.2);
  }

  .bg-gray-status {
    background: rgba(107, 114, 128, 0.1);
    color: #6b7280;
    border-color: rgba(107, 114, 128, 0.2);
  }
</style>
