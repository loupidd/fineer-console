<script>
  import { onMount } from "svelte";
  import { collection, getDocs, query, where } from "firebase/firestore";
  import { db } from "../services/firebase";
  import { authStore } from "../../stores/auth";
  import { fade, fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { language } from "../../stores/language";
  import { translations } from "../i18n/translations";

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

  async function loadDashboardData() {
    loading = true;
    try {
      // Load users count
      const usersRef = collection(db, "users");
      const usersSnap = await getDocs(usersRef);
      stats.totalEmployees = usersSnap.size;

      // Load forms data
      const formsRef = collection(db, "forms");
      const formsSnap = await getDocs(formsRef);
      /** @type {any[]} */
      const allForms = formsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      stats.totalSubmissions = allForms.length;
      stats.pendingApprovals = allForms.filter(
        (f) => f.status === "approved_by_admin"
      ).length;

      // Current month statistics
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      stats.approvedThisMonth = allForms.filter((f) => {
        if (f.status !== "approved") return false;
        const approvedDate = f.approvedByDirekturAt?.toDate();
        return approvedDate && approvedDate >= startOfMonth;
      }).length;

      stats.rejectedThisMonth = allForms.filter((f) => {
        if (f.status !== "rejected") return false;
        const rejectedDate = f.rejectedAt?.toDate();
        return rejectedDate && rejectedDate >= startOfMonth;
      }).length;

      // Form type counts
      stats.totalLeaves = allForms.filter((f) => f.formType === "leave").length;
      stats.totalOvertimes = allForms.filter(
        (f) => f.formType === "overtime"
      ).length;
      stats.totalPermissions = allForms.filter(
        (f) => f.formType === "permission"
      ).length;

      // Calculate average approval time (in hours)
      const approvedForms = allForms.filter(
        (f) => f.status === "approved" && f.createdAt && f.approvedByDirekturAt
      );

      if (approvedForms.length > 0) {
        const totalTime = approvedForms.reduce((sum, form) => {
          const created = form.createdAt.toDate().getTime();
          const approved = form.approvedByDirekturAt.toDate().getTime();
          return sum + (approved - created);
        }, 0);
        stats.avgApprovalTime = Math.round(
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
      const expectedAttendance = stats.totalEmployees * workDaysThisMonth;
      if (expectedAttendance > 0) {
        stats.attendanceRate = Math.round(
          (attendanceRecords.length / expectedAttendance) * 100
        );
      }

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

      topEmployeesBySubmissions = Object.values(submissionsByUser)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Recent approvals by direktur
      recentApprovals = allForms
        .filter((f) => f.status === "approved" && f.approvedByDirektur)
        .sort((a, b) => {
          const aTime = a.approvedByDirekturAt?.seconds || 0;
          const bTime = b.approvedByDirekturAt?.seconds || 0;
          return bTime - aTime;
        })
        .slice(0, 5);
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

<div class="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-6">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8" in:fade={{ duration: 400 }}>
      <h1 class="text-4xl font-bold text-[#1A4786] mb-2">
        {t.title}
      </h1>
      <p class="text-gray-600">
        {t.subtitle}
      </p>
    </div>

    {#if loading}
      <div class="flex flex-col items-center justify-center py-20">
        <div
          class="w-16 h-16 border-4 border-gray-200 border-t-[#3A7AE0] rounded-full animate-spin"
        ></div>
        <p class="mt-4 text-gray-500 font-medium">
          {t.loadingData}
        </p>
      </div>
    {:else}
      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <!-- Total Employees -->
        <div
          class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all"
          in:fly={{ y: 20, duration: 400, delay: 0, easing: quintOut }}
        >
          <div class="flex items-center justify-between mb-4">
            <div class="p-3 bg-blue-100 rounded-xl">
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
          </div>
          <h3 class="text-3xl font-bold text-gray-900 mb-1">
            {stats.totalEmployees}
          </h3>
          <p class="text-sm text-gray-600">
            {t.totalEmployees}
          </p>
        </div>

        <!-- Pending Approvals -->
        <div
          class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all"
          in:fly={{ y: 20, duration: 400, delay: 50, easing: quintOut }}
        >
          <div class="flex items-center justify-between mb-4">
            <div class="p-3 bg-amber-100 rounded-xl">
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
          <h3 class="text-3xl font-bold text-gray-900 mb-1">
            {stats.pendingApprovals}
          </h3>
          <p class="text-sm text-gray-600">
            {t.pendingApprovals}
          </p>
        </div>

        <!-- Approved This Month -->
        <div
          class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all"
          in:fly={{ y: 20, duration: 400, delay: 100, easing: quintOut }}
        >
          <div class="flex items-center justify-between mb-4">
            <div class="p-3 bg-green-100 rounded-xl">
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <h3 class="text-3xl font-bold text-gray-900 mb-1">
            {stats.approvedThisMonth}
          </h3>
          <p class="text-sm text-gray-600">
            {t.approvedThisMonth}
          </p>
        </div>

        <!-- Attendance Rate -->
        <div
          class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all"
          in:fly={{ y: 20, duration: 400, delay: 150, easing: quintOut }}
        >
          <div class="flex items-center justify-between mb-4">
            <div class="p-3 bg-indigo-100 rounded-xl">
              <svg
                class="w-6 h-6 text-indigo-600"
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
          <h3 class="text-3xl font-bold text-gray-900 mb-1">
            {stats.attendanceRate}%
          </h3>
          <p class="text-sm text-gray-600">
            {t.attendanceRate}
          </p>
        </div>
      </div>

      <!-- Secondary Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div
          class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          in:fly={{ y: 20, duration: 400, delay: 200, easing: quintOut }}
        >
          <div class="flex items-center gap-4">
            <div class="p-3 bg-red-100 rounded-xl">
              <svg
                class="w-6 h-6 text-red-600"
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
              <h4 class="text-2xl font-bold text-gray-900">
                {stats.rejectedThisMonth}
              </h4>
              <p class="text-sm text-gray-600">{t.rejectedThisMonth}</p>
            </div>
          </div>
        </div>

        <div
          class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          in:fly={{ y: 20, duration: 400, delay: 250, easing: quintOut }}
        >
          <div class="flex items-center gap-4">
            <div class="p-3 bg-teal-100 rounded-xl">
              <svg
                class="w-6 h-6 text-teal-600"
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
              <h4 class="text-2xl font-bold text-gray-900">
                {stats.avgApprovalTime}h
              </h4>
              <p class="text-sm text-gray-600">{t.avgApprovalTime}</p>
            </div>
          </div>
        </div>

        <div
          class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          in:fly={{ y: 20, duration: 400, delay: 300, easing: quintOut }}
        >
          <div class="flex items-center gap-4">
            <div class="p-3 bg-purple-100 rounded-xl">
              <svg
                class="w-6 h-6 text-purple-600"
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
              <h4 class="text-2xl font-bold text-gray-900">
                {stats.totalSubmissions}
              </h4>
              <p class="text-sm text-gray-600">{t.totalSubmissions}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Form Types Breakdown -->
      <div
        class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8"
        in:fly={{ y: 20, duration: 400, delay: 200, easing: quintOut }}
      >
        <h2 class="text-xl font-bold text-[#1A4786] mb-6">
          {t.submissionTypes}
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="text-center p-4 bg-blue-50 rounded-xl">
            <div class="text-4xl font-bold text-blue-600 mb-2">
              {stats.totalLeaves}
            </div>
            <p class="text-sm text-gray-700 font-medium">
              {t.leaveRequests}
            </p>
          </div>
          <div class="text-center p-4 bg-orange-50 rounded-xl">
            <div class="text-4xl font-bold text-orange-600 mb-2">
              {stats.totalOvertimes}
            </div>
            <p class="text-sm text-gray-700 font-medium">
              {t.overtimeRequests}
            </p>
          </div>
          <div class="text-center p-4 bg-indigo-50 rounded-xl">
            <div class="text-4xl font-bold text-indigo-600 mb-2">
              {stats.totalPermissions}
            </div>
            <p class="text-sm text-gray-700 font-medium">
              {t.permissionRequests}
            </p>
          </div>
        </div>
      </div>

      <!-- Recent Approvals -->
      <div
        class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8"
        in:fly={{ y: 20, duration: 400, delay: 350, easing: quintOut }}
      >
        <h2 class="text-xl font-bold text-[#1A4786] mb-6">
          {t.recentApprovals}
        </h2>
        {#if recentApprovals.length === 0}
          <div class="text-center py-12">
            <svg
              class="w-16 h-16 text-gray-300 mx-auto mb-4"
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
            <p class="text-gray-500">
              {t.noApprovals}
            </p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each recentApprovals as approval}
              <div
                class="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <span
                        class="px-3 py-1 text-xs font-bold bg-green-100 text-green-700 rounded-full"
                      >
                        {approval.formType === "leave"
                          ? t.leave
                          : approval.formType === "overtime"
                            ? t.overtime
                            : t.permission}
                      </span>
                      <span class="text-xs text-gray-500">
                        {formatDate(approval.approvedByDirekturAt)}
                      </span>
                    </div>
                    <h3 class="font-bold text-gray-900 mb-1">
                      {approval.userName}
                    </h3>
                    <p class="text-sm text-gray-600">NIK: {approval.userNik}</p>
                    {#if approval.formType === "leave"}
                      <p class="text-sm text-gray-700 mt-2">
                        {approval.startDate} - {approval.endDate} ({approval.totalDays}
                        {t.days})
                      </p>
                    {/if}
                  </div>
                  <svg
                    class="w-8 h-8 text-green-500 shrink-0"
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
            {/each}
          </div>
        {/if}
      </div>

      <!-- Top Employees by Submissions -->
      <div
        class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        in:fly={{ y: 20, duration: 400, delay: 400, easing: quintOut }}
      >
        <h2 class="text-xl font-bold text-[#1A4786] mb-6">
          {t.topEmployees}
        </h2>
        {#if topEmployeesBySubmissions.length === 0}
          <div class="text-center py-12">
            <svg
              class="w-16 h-16 text-gray-300 mx-auto mb-4"
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
            <p class="text-gray-500">{t.noData}</p>
          </div>
        {:else}
          <div class="space-y-3">
            {#each topEmployeesBySubmissions as employee, index}
              <div
                class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all"
              >
                <div
                  class="shrink-0 w-10 h-10 bg-linear-to-br from-[#1A4786] to-[#3A7AE0] text-white rounded-full flex items-center justify-center font-bold text-lg"
                >
                  {index + 1}
                </div>
                <div class="flex-1">
                  <h3 class="font-bold text-gray-900">{employee.userName}</h3>
                  <p class="text-xs text-gray-500">NIK: {employee.userNik}</p>
                </div>
                <div class="text-right">
                  <p class="text-2xl font-bold text-[#1A4786]">
                    {employee.count}
                  </p>
                  <p class="text-xs text-gray-500">{t.submissions}</p>
                  <p class="text-xs text-green-600 font-semibold">
                    {employee.approved}
                    {t.approved}
                  </p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
