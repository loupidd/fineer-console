<script>
  import { onMount } from "svelte";
  import { collection, getDocs, query, where } from "firebase/firestore";
  import { db } from "../services/firebase";
  import { authStore } from "../../stores/auth";
  import { fade, fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { language } from "../../stores/language";
  import { translations } from "../i18n/translations";
  import { dataCache } from "../utils/dataCache";

  $: t = translations[$language].Dashboard;

  let loading = true;
  let stats = {
    totalEmployees: 0,
    totalSubmissions: 0,
    pendingApprovals: 0,
    approvedThisMonth: 0,
    rejectedThisMonth: 0,
    totalLeaves: 0,
    totalOvertimes: 0,
    totalPermissions: 0,
    avgApprovalTime: 0,
    attendanceRate: 0,
  };

  let recentApprovals = [];
  let topEmployeesBySubmissions = [];

  onMount(() => {
    loadDashboardData();
  });

  async function fetchDirekturDashboardData() {
    // Load users count
    const usersRef = collection(db, "users");
    const usersSnap = await getDocs(usersRef);
    const totalEmployees = usersSnap.size;

    // Load forms data
    const formsRef = collection(db, "forms");
    const formsSnap = await getDocs(formsRef);
    const allForms = formsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        status: data.status || "",
        approvedByDirekturAt: data.approvedByDirekturAt || null,
        rejectedAt: data.rejectedAt || null,
        formType: data.formType || "",
        createdAt: data.createdAt || null,
        approvedByDirektur: data.approvedByDirektur || false,
        userId: data.userId || "",
        userName: data.userName || "",
        userNik: data.userNik || "",
        ...data,
      };
    });

    const totalSubmissions = allForms.length;
    const pendingApprovals = allForms.filter(
      (f) => f.status === "approved_by_admin"
    ).length;

    // Current month statistics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const approvedThisMonth = allForms.filter((f) => {
      if (f.status !== "approved") return false;
      const approvedDate = f.approvedByDirekturAt?.toDate();
      return approvedDate && approvedDate >= startOfMonth;
    }).length;

    const rejectedThisMonth = allForms.filter((f) => {
      if (f.status !== "rejected") return false;
      const rejectedDate = f.rejectedAt?.toDate();
      return rejectedDate && rejectedDate >= startOfMonth;
    }).length;

    // Form type counts
    const totalLeaves = allForms.filter((f) => f.formType === "leave").length;
    const totalOvertimes = allForms.filter(
      (f) => f.formType === "overtime"
    ).length;
    const totalPermissions = allForms.filter(
      (f) => f.formType === "permission"
    ).length;

    // Calculate average approval time (in hours)
    const approvedForms = allForms.filter(
      (f) => f.status === "approved" && f.createdAt && f.approvedByDirekturAt
    );

    let avgApprovalTime = 0;
    if (approvedForms.length > 0) {
      const totalTime = approvedForms.reduce((sum, form) => {
        const created = form.createdAt.toDate().getTime();
        const approved = form.approvedByDirekturAt.toDate().getTime();
        return sum + (approved - created);
      }, 0);
      avgApprovalTime = Math.round(
        totalTime / approvedForms.length / (1000 * 60 * 60)
      ); // Convert to hours
    }

    // Calculate attendance rate for current month
    const attendanceRef = collection(db, "attendance");
    const attendanceSnap = await getDocs(attendanceRef);
    const attendanceRecords = attendanceSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((record) => {
        // @ts-ignore
        const recordDate = new Date(record.date);
        return recordDate >= startOfMonth;
      });

    const workDaysThisMonth = getWorkDaysInMonth(now);
    const expectedAttendance = totalEmployees * workDaysThisMonth;
    const attendanceRate =
      expectedAttendance > 0
        ? Math.round((attendanceRecords.length / expectedAttendance) * 100)
        : 0;

    // Top employees by submissions
    const submissionsByUser = {};
    allForms.forEach((form) => {
      const userId = form.userId;
      if (userId) {
        if (!submissionsByUser[userId]) {
          submissionsByUser[userId] = {
            userId,
            userName: form.userName,
            userNik: form.userNik,
            count: 0,
            approved: 0,
          };
        }
        submissionsByUser[userId].count++;
        if (form.status === "approved") {
          submissionsByUser[userId].approved++;
        }
      }
    });

    const topEmployees = Object.values(submissionsByUser)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Recent approvals by direktur
    const recentApprovalsList = allForms
      .filter((f) => f.status === "approved" && f.approvedByDirektur)
      .sort((a, b) => {
        const aTime = a.approvedByDirekturAt?.seconds || 0;
        const bTime = b.approvedByDirekturAt?.seconds || 0;
        return bTime - aTime;
      })
      .slice(0, 5);

    return {
      stats: {
        totalEmployees,
        totalSubmissions,
        pendingApprovals,
        approvedThisMonth,
        rejectedThisMonth,
        totalLeaves,
        totalOvertimes,
        totalPermissions,
        avgApprovalTime,
        attendanceRate,
      },
      recentApprovals: recentApprovalsList,
      topEmployeesBySubmissions: topEmployees,
    };
  }

  async function loadDashboardData(forceRefresh = false) {
    loading = true;
    try {
      if (forceRefresh) {
        dataCache.invalidate("direktur-dashboard");
      }

      // Use cache with 3 minute expiry (180000ms) - longer cache for dashboard
      const data = await dataCache.getData(
        "direktur-dashboard",
        fetchDirekturDashboardData,
        180000
      );

      stats = data.stats;
      recentApprovals = data.recentApprovals;
      topEmployeesBySubmissions = data.topEmployeesBySubmissions;
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      loading = false;
    }
  }

  function getWorkDaysInMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let workDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const dayOfWeek = currentDate.getDay();
      // Count Monday-Friday as work days
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workDays++;
      }
    }

    return workDays;
  }

  function formatDate(timestamp) {
    if (!timestamp) return "-";
    return new Date(timestamp.seconds * 1000).toLocaleString(
      $language === "id" ? "id-ID" : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }
</script>

<div class="min-h-screen" style="background-color: #F8F8F8;">
  <div class="max-w-7xl mx-auto p-6">
    <!-- Blue Header Banner -->
    <div
      class="rounded-3xl p-8 mb-8"
      style="background: linear-gradient(135deg, #1A4786 0%, #3A7AE0 100%);"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div
            class="w-16 h-16 bg-white rounded-2xl flex items-center justify-center"
          >
            <svg
              class="w-8 h-8"
              style="color: #1A4786;"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <div>
            <h1 class="text-4xl font-bold text-white mb-1">
              Director Dashboard
            </h1>
            <p class="text-white text-opacity-95 text-lg">
              Company data summary and approvals
            </p>
          </div>
        </div>
        <button
          on:click={() => loadDashboardData(true)}
          class="px-6 py-3 bg-white text-lg font-semibold rounded-2xl flex items-center gap-2 hover:shadow-lg transition-all"
          style="color: #1A4786;"
          disabled={loading}
        >
          <svg
            class="w-5 h-5"
            style="color: #1A4786;"
            class:animate-spin={loading}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>
    </div>

    {#if loading}
      <div class="flex items-center justify-center py-20">
        <div
          class="w-16 h-16 border-4 border-gray-300 rounded-full animate-spin"
          style="border-top-color: #3A7AE0;"
        ></div>
      </div>
    {:else}
      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <!-- Total Employees -->
        <div class="bg-white rounded-3xl p-8">
          <div
            class="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
            style="background-color: #E3EEFF;"
          >
            <svg
              class="w-7 h-7"
              style="color: #1A4786;"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div class="text-5xl font-bold mb-2" style="color: #1A4786;">
            {stats.totalEmployees}
          </div>
          <div
            class="text-sm text-gray-500 font-medium uppercase tracking-wider"
          >
            Total Employees
          </div>
        </div>

        <!-- Pending Approvals - HIGHLIGHTED -->
        <div
          class="rounded-3xl p-8"
          style="background-color: #FFFDF0; border: 3px solid #FFD700;"
        >
          <div class="flex items-center justify-between mb-6">
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center"
              style="background-color: #FFF4CC;"
            >
              <svg
                class="w-7 h-7"
                style="color: #B8860B;"
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
            {#if stats.pendingApprovals > 0}
              <span
                class="px-3 py-1.5 text-xs font-bold rounded-lg uppercase"
                style="background-color: #FFD700; color: #1A4786;">Action</span
              >
            {/if}
          </div>
          <div class="text-5xl font-bold mb-2" style="color: #B8860B;">
            {stats.pendingApprovals}
          </div>
          <div
            class="text-sm font-medium uppercase tracking-wider"
            style="color: #7A6A2E;"
          >
            Pending Approvals
          </div>
        </div>

        <!-- Approved This Month -->
        <div class="bg-white rounded-3xl p-8">
          <div
            class="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
            style="background-color: #E8F5E9;"
          >
            <svg
              class="w-7 h-7"
              style="color: #2E7D32;"
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
          <div class="text-5xl font-bold mb-2" style="color: #2E7D32;">
            {stats.approvedThisMonth}
          </div>
          <div
            class="text-sm text-gray-500 font-medium uppercase tracking-wider"
          >
            Approved This Month
          </div>
        </div>

        <!-- Attendance Rate -->
        <div class="bg-white rounded-3xl p-8">
          <div
            class="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
            style="background-color: #E3EEFF;"
          >
            <svg
              class="w-7 h-7"
              style="color: #1A4786;"
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
          <div class="text-5xl font-bold mb-2" style="color: #1A4786;">
            {stats.attendanceRate}%
          </div>
          <div
            class="text-sm text-gray-500 font-medium uppercase tracking-wider"
          >
            Attendance Rate
          </div>
        </div>
      </div>

      <!-- Submission Types -->
      <div class="bg-white rounded-3xl p-8 mb-8">
        <h2 class="text-2xl font-bold mb-8" style="color: #1A4786;">
          Submission Types
        </h2>

        <div
          class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pb-8 border-b border-gray-200"
        >
          <div
            class="text-center p-8 rounded-2xl"
            style="background-color: #F8F8F8;"
          >
            <div class="text-5xl font-bold mb-3" style="color: #1A4786;">
              {stats.totalLeaves}
            </div>
            <div
              class="text-sm text-gray-600 font-medium uppercase tracking-wider"
            >
              Leave Requests
            </div>
          </div>
          <div
            class="text-center p-8 rounded-2xl"
            style="background-color: #F8F8F8;"
          >
            <div class="text-5xl font-bold mb-3" style="color: #1A4786;">
              {stats.totalOvertimes}
            </div>
            <div
              class="text-sm text-gray-600 font-medium uppercase tracking-wider"
            >
              Overtime Requests
            </div>
          </div>
          <div
            class="text-center p-8 rounded-2xl"
            style="background-color: #F8F8F8;"
          >
            <div class="text-5xl font-bold mb-3" style="color: #1A4786;">
              {stats.totalPermissions}
            </div>
            <div
              class="text-sm text-gray-600 font-medium uppercase tracking-wider"
            >
              Permission Requests
            </div>
          </div>
        </div>

        <!-- Additional Metrics -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="flex items-center gap-5">
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center"
              style="background-color: #FFEBEE;"
            >
              <svg
                class="w-7 h-7"
                style="color: #C62828;"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div>
              <div class="text-4xl font-bold" style="color: #1A4786;">
                {stats.rejectedThisMonth}
              </div>
              <div
                class="text-xs text-gray-600 font-medium uppercase tracking-wider"
              >
                Rejected This Month
              </div>
            </div>
          </div>

          <div class="flex items-center gap-5">
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center"
              style="background-color: #E3EEFF;"
            >
              <svg
                class="w-7 h-7"
                style="color: #1A4786;"
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
            <div>
              <div class="text-4xl font-bold" style="color: #1A4786;">
                {stats.avgApprovalTime}h
              </div>
              <div
                class="text-xs text-gray-600 font-medium uppercase tracking-wider"
              >
                Avg. Approval Time
              </div>
            </div>
          </div>

          <div class="flex items-center gap-5">
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center"
              style="background-color: #E3EEFF;"
            >
              <svg
                class="w-7 h-7"
                style="color: #1A4786;"
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
            </div>
            <div>
              <div class="text-4xl font-bold" style="color: #1A4786;">
                {stats.totalSubmissions}
              </div>
              <div
                class="text-xs text-gray-600 font-medium uppercase tracking-wider"
              >
                Total Submissions
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Approvals -->
      <div class="bg-white rounded-3xl p-8 mb-8">
        <h2 class="text-2xl font-bold mb-8" style="color: #1A4786;">
          Recent Approvals
        </h2>
        {#if recentApprovals.length === 0}
          <div class="text-center py-20">
            <svg
              class="w-20 h-20 text-gray-300 mx-auto mb-4"
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
            <p class="text-gray-400 font-medium">No recent approvals</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each recentApprovals as approval}
              <div class="border-2 border-gray-200 rounded-3xl p-6">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-4">
                      <span
                        class="px-4 py-2 text-sm font-bold rounded-xl uppercase text-white"
                        style="background-color: #3A7AE0;"
                      >
                        {approval.formType === "leave"
                          ? "Leave Request"
                          : approval.formType === "overtime"
                            ? "Overtime Request"
                            : "Permission Request"}
                      </span>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                      <svg
                        class="w-5 h-5"
                        style="color: #FFD700;"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                        />
                      </svg>
                      <span class="font-bold text-lg" style="color: #1A4786;"
                        >{approval.userName}</span
                      >
                      <span class="text-gray-500">({approval.userNik})</span>
                    </div>
                    <div
                      class="flex items-center gap-2 text-sm text-gray-600 mb-3"
                    >
                      <svg
                        class="w-4 h-4"
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
                      <span
                        >Submitted: {formatDate(
                          approval.approvedByDirekturAt
                        )}</span
                      >
                    </div>
                    {#if approval.formType === "leave"}
                      <div class="mt-4 space-y-2">
                        <div>
                          <div class="text-xs text-gray-500 uppercase mb-1">
                            Date
                          </div>
                          <div class="font-bold" style="color: #1A4786;">
                            {approval.startDate} - {approval.endDate}
                          </div>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Top Employees -->
      <div class="bg-white rounded-3xl p-8">
        <h2 class="text-2xl font-bold mb-8" style="color: #1A4786;">
          Top Employees by Submissions
        </h2>
        {#if topEmployeesBySubmissions.length === 0}
          <div class="text-center py-20">
            <svg
              class="w-20 h-20 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p class="text-gray-400 font-medium">No data available</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each topEmployeesBySubmissions as employee, index}
              <div class="border-2 border-gray-200 rounded-3xl p-6">
                <div class="flex items-center gap-6">
                  <div class="relative shrink-0">
                    <div
                      class="w-16 h-16 text-white rounded-2xl flex items-center justify-center font-bold text-2xl"
                      style="background-color: #3A7AE0;"
                    >
                      {index + 1}
                    </div>
                    {#if index === 0}
                      <div
                        class="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center"
                        style="background-color: #FFD700;"
                      >
                        <svg
                          class="w-5 h-5"
                          style="color: #1A4786;"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                          />
                        </svg>
                      </div>
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-bold text-xl mb-1" style="color: #1A4786;">
                      {employee.userName}
                    </div>
                    <div class="text-sm text-gray-600 font-medium">
                      NIK: {employee.userNik}
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <div
                      class="text-4xl font-bold mb-2"
                      style="color: #1A4786;"
                    >
                      {employee.count}
                    </div>
                    <div
                      class="text-xs text-gray-600 font-medium uppercase tracking-wider mb-3"
                    >
                      Submissions
                    </div>
                    <div
                      class="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                      style="background-color: #E8F5E9;"
                    >
                      <svg
                        class="w-4 h-4"
                        style="color: #2E7D32;"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="3"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span class="text-sm font-bold" style="color: #2E7D32;"
                        >{employee.approved}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Primary Blue: #1A4786 */
  /* Secondary Blue: #3A7AE0 */
  /* Yellow: #FFD700 */
  /* Background: #F8F8F8 */
</style>
