<script>
  import { onMount } from "svelte";
  import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    Timestamp,
  } from "firebase/firestore";
  import { db } from "../services/firebase";
  import { authStore } from "../../stores/auth";
  import { fade, fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";

  export let language = "en";

  // Translation object
  const translations = {
    en: {
      title: "Forms & Submissions",
      subtitle: "Submit and manage leave and overtime requests",
      leaveRequest: "Leave Request",
      overtimeRequest: "Overtime Request",
      permissionRequest: "Permission Request",
      pendingSubmissions: "Pending",
      approvedSubmissions: "Approved",
      rejectedSubmissions: "Rejected",

      // Leave form fields
      leaveType: "Leave Type",
      selectLeaveType: "Select leave type",
      annualLeave: "Annual Leave",
      sickLeave: "Sick Leave",
      emergencyLeave: "Emergency Leave",
      startDate: "Start Date",
      endDate: "End Date",
      totalDays: "Total Days",
      reason: "Reason",
      reasonPlaceholder: "Please explain your leave request...",
      leaveNote:
        "Note: Leave requests must be submitted at least 7 days in advance.",

      // Overtime form fields
      overtimeDate: "Overtime Date",
      startTime: "Start Time",
      endTime: "End Time",
      totalHours: "Total Hours",
      workDescription: "Work Description",
      workDescPlaceholder: "Describe the work or task performed...",

      // Permission form fields
      permissionType: "Permission Type",
      selectPermissionType: "Select permission type",
      lateArrival: "Late Arrival",
      earlyLeave: "Early Leave",
      sick: "Sick",
      date: "Date",
      detailsOfPurpose: "Details of Purpose",
      detailsPlaceholder: "Please provide details...",

      // Common
      other: "Other",
      submit: "Submit Request",
      submitting: "Submitting...",
      allSubmissions: "All Submissions",
      mySubmissions: "My Submissions",
      refresh: "Refresh",
      loading: "Loading submissions...",
      noSubmissions: "No submissions found",
      submitted: "Submitted",
      approved: "Approved",
      rejected: "Rejected",
      pending: "Pending",
      approve: "Approve",
      reject: "Reject",
      approvedBy: "by",
      hours: "hours",
      type: "Type",
    },
    id: {
      title: "Formulir & Pengajuan",
      subtitle: "Kirim dan kelola permintaan cuti dan lembur",
      leaveRequest: "Permintaan Cuti",
      overtimeRequest: "Permintaan Lembur",
      permissionRequest: "Permintaan Ijin",

      // Leave form fields
      leaveType: "Jenis Cuti Yang Diajukan",
      selectLeaveType: "Pilih jenis cuti",
      annualLeave: "Cuti Tahunan",
      sickLeave: "Cuti Sakit",
      emergencyLeave: "Cuti Darurat",
      startDate: "Tanggal Mulai",
      endDate: "Tanggal Selesai",
      totalDays: "Total Hari Cuti",
      reason: "Keperluan",
      reasonPlaceholder: "Mohon jelaskan keperluan cuti Anda...",
      leaveNote: "Keterangan: Permintaan cuti minimal 7 hari sebelumnya.",

      // Overtime form fields
      overtimeDate: "Tanggal Lembur",
      startTime: "Jam Mulai",
      endTime: "Jam Selesai",
      totalHours: "Total Jam",
      workDescription: "Deskripsi Pekerjaan",
      workDescPlaceholder: "Jelaskan pekerjaan yang dilakukan...",

      // Permission form fields
      permissionType: "Jenis Ijin",
      selectPermissionType: "Pilih jenis ijin",
      lateArrival: "Terlambat",
      earlyLeave: "Pulang Cepat",
      sick: "Sakit",
      date: "Tanggal",
      detailsOfPurpose: "Keterangan",
      detailsPlaceholder: "Mohon jelaskan keterangan...",

      // Common
      other: "Lainnya",
      submit: "Kirim Permohonan",
      submitting: "Mengirim...",
      allSubmissions: "Semua Pengajuan",
      mySubmissions: "Pengajuan Saya",
      refresh: "Segarkan",
      loading: "Memuat pengajuan...",
      noSubmissions: "Tidak ada pengajuan",
      submitted: "Dikirim",
      approved: "Disetujui",
      rejected: "Ditolak",
      pending: "Menunggu",
      approve: "Setujui",
      reject: "Tolak",
      approvedBy: "oleh",
      hours: "jam",
      type: "Jenis",
    },
  };

  // Reactive translation
  $: t = translations[language];

  // User authentication and role
  let isAdmin = false;
  let currentUserId = "";

  $: isAdmin = $authStore.userData?.role === "admin";
  $: currentUserId = $authStore.userData?.id;

  // View and filter states
  let activeForm = "leave";
  let currentView = "selection";
  let activeFilter = "all";
  let loading = false;
  let submissions = [];

  // LEAVE FORM STATE
  // Updated to match the new leave form design with date range
  let leaveForm = {
    type: "",
    startDate: "",
    endDate: "",
    totalDays: 0,
    reason: "",
    status: "pending",
  };

  // OVERTIME FORM STATE
  // Updated to match the new overtime form design with time range
  let overtimeForm = {
    type: "overtime",
    date: "",
    startTime: "",
    endTime: "",
    totalHours: 0,
    workDescription: "",
    status: "pending",
  };

  // PERMISSION FORM STATE
  // New permission form state
  let permissionForm = {
    type: "",
    date: "",
    details: "",
    status: "pending",
  };

  // Initialize component
  onMount(() => {
    loadSubmissions();
  });

  // LOAD SUBMISSIONS FROM FIRESTORE
  async function loadSubmissions() {
    loading = true;
    try {
      const formsRef = collection(db, "forms");
      const snap = await getDocs(formsRef);

      let allSubmissions = snap.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          userId: data.userId || null,
          createdAt: data.createdAt || null,
          ...data,
        };
      });

      // Filter by user if not admin
      if (!isAdmin && currentUserId) {
        allSubmissions = allSubmissions.filter(
          (s) => s.userId && s.userId === currentUserId
        );
      }

      // Sort by creation date descending
      allSubmissions.sort((a, b) => {
        const aTime =
          typeof a.createdAt === "object" && a.createdAt?.seconds
            ? a.createdAt.seconds
            : 0;
        const bTime =
          typeof b.createdAt === "object" && b.createdAt?.seconds
            ? b.createdAt.seconds
            : 0;
        return bTime - aTime;
      });

      submissions = allSubmissions;
    } catch (error) {
      console.error("Error loading submissions:", error);
      alert("Error loading submissions: " + error.message);
    } finally {
      loading = false;
    }
  }

  // CALCULATE LEAVE DAYS
  // Calculate the number of days between start and end date
  function calculateLeaveDays() {
    if (leaveForm.startDate && leaveForm.endDate) {
      const start = new Date(leaveForm.startDate);
      const end = new Date(leaveForm.endDate);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        leaveForm.totalDays = diffDays > 0 ? diffDays : 0;
      } else {
        leaveForm.totalDays = 0;
      }
    } else {
      leaveForm.totalDays = 0;
    }
  }

  // CALCULATE TOTAL HOURS FOR OVERTIME
  // Calculate hours between start and end time
  function calculateTotalHours() {
    if (overtimeForm.startTime && overtimeForm.endTime) {
      const start = overtimeForm.startTime.split(":");
      const end = overtimeForm.endTime.split(":");

      const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
      const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);

      let diffMinutes = endMinutes - startMinutes;

      // Handle overnight overtime
      if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
      }

      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;

      // Convert to number instead of string
      overtimeForm.totalHours = Number((hours + minutes / 60).toFixed(1));
    } else {
      overtimeForm.totalHours = 0;
    }
  }

  // SUBMIT LEAVE REQUEST
  async function submitLeaveRequest() {
    if (
      !leaveForm.type ||
      !leaveForm.startDate ||
      !leaveForm.endDate ||
      !leaveForm.reason
    ) {
      alert("Please fill in all required fields");
      return;
    }

    loading = true;
    try {
      await addDoc(collection(db, "forms"), {
        formType: "leave",
        leaveType: leaveForm.type,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        totalDays: leaveForm.totalDays,
        reason: leaveForm.reason,
        status: leaveForm.status,
        userId: currentUserId,
        userName: $authStore.userData.name,
        userNik: $authStore.userData.nik,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      alert("Leave request submitted successfully");
      resetLeaveForm();
      loadSubmissions();
    } catch (error) {
      console.error("Error submitting leave request:", error);
      alert("Failed to submit leave request");
    } finally {
      loading = false;
    }
  }

  // SUBMIT OVERTIME REQUEST
  async function submitOvertimeRequest() {
    if (
      !overtimeForm.date ||
      !overtimeForm.startTime ||
      !overtimeForm.endTime ||
      !overtimeForm.workDescription
    ) {
      alert("Please fill in all required fields");
      return;
    }

    loading = true;
    try {
      await addDoc(collection(db, "forms"), {
        formType: "overtime",
        date: overtimeForm.date,
        startTime: overtimeForm.startTime,
        endTime: overtimeForm.endTime,
        totalHours: overtimeForm.totalHours,
        workDescription: overtimeForm.workDescription,
        status: overtimeForm.status,
        userId: currentUserId,
        userName: $authStore.userData.name,
        userNik: $authStore.userData.nik,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      alert("Overtime request submitted successfully");
      resetOvertimeForm();
      loadSubmissions();
    } catch (error) {
      console.error("Error submitting overtime request:", error);
      alert("Failed to submit overtime request");
    } finally {
      loading = false;
    }
  }

  // SUBMIT PERMISSION REQUEST
  async function submitPermissionRequest() {
    if (
      !permissionForm.type ||
      !permissionForm.date ||
      !permissionForm.details
    ) {
      alert("Please fill in all required fields");
      return;
    }

    loading = true;
    try {
      await addDoc(collection(db, "forms"), {
        formType: "permission",
        permissionType: permissionForm.type,
        date: permissionForm.date,
        details: permissionForm.details,
        status: permissionForm.status,
        userId: currentUserId,
        userName: $authStore.userData.name,
        userNik: $authStore.userData.nik,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      alert("Permission request submitted successfully");
      resetPermissionForm();
      loadSubmissions();
    } catch (error) {
      console.error("Error submitting permission request:", error);
      alert("Failed to submit permission request");
    } finally {
      loading = false;
    }
  }

  // UPDATE SUBMISSION STATUS
  // Admin and direktur approval workflow
  async function updateStatus(formId, newStatus) {
    loading = true;
    try {
      const updateData = {
        updatedAt: Timestamp.now(),
      };

      // Admin approval
      if (
        newStatus === "approved" &&
        isAdmin &&
        $authStore.userData?.role === "admin"
      ) {
        updateData.status = "approved_by_admin";
        updateData.approvedByAdmin = $authStore.userData.name;
        updateData.approvedByAdminAt = Timestamp.now();
        alert("Form approved by admin. Waiting for direktur approval.");
      }
      // Direktur approval
      else if (
        newStatus === "approved" &&
        $authStore.userData?.role === "direktur"
      ) {
        updateData.status = "approved";
        updateData.approvedByDirektur = $authStore.userData.name;
        updateData.approvedByDirekturAt = Timestamp.now();
        alert("Form fully approved by direktur.");
      }
      // Rejection at any stage
      else if (newStatus === "rejected") {
        updateData.status = "rejected";
        updateData.rejectedBy = $authStore.userData.name;
        updateData.rejectedAt = Timestamp.now();
        alert("Form rejected.");
      }

      await updateDoc(doc(db, "forms", formId), updateData);
      loadSubmissions();
    } catch (error) {
      console.error("Error updating form status:", error);
      alert("Failed to update form status");
    } finally {
      loading = false;
    }
  }

  // RESET FORM FUNCTIONS
  function resetLeaveForm() {
    leaveForm = {
      type: "",
      startDate: "",
      endDate: "",
      totalDays: 0,
      reason: "",
      status: "pending",
    };
  }

  function resetOvertimeForm() {
    overtimeForm = {
      type: "overtime",
      date: "",
      startTime: "",
      endTime: "",
      totalHours: 0,
      workDescription: "",
      status: "pending",
    };
  }

  function resetPermissionForm() {
    permissionForm = {
      type: "",
      date: "",
      details: "",
      status: "pending",
    };
  }

  // FORMAT TIMESTAMP FOR DISPLAY
  function formatDate(timestamp) {
    if (!timestamp) return "-";
    return new Date(timestamp.seconds * 1000).toLocaleString(
      language === "id" ? "id-ID" : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  // FILTER SUBMISSIONS BASED ON ACTIVE FILTER
  $: filteredSubmissions = submissions.filter((submission) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "pending")
      return (
        submission.status === "pending" ||
        submission.status === "approved_by_admin"
      );
    if (activeFilter === "approved") return submission.status === "approved";
    if (activeFilter === "rejected") return submission.status === "rejected";
    return true;
  });
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
  <!-- Header Card -->
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
          class="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg"
        >
          <svg
            class="w-7 h-7 text-[#FFD700]"
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
          <h1 class="text-3xl font-bold">{t.title}</h1>
          <p class="text-sm text-white/90 mt-1">{t.subtitle}</p>
        </div>
      </div>
    </div>
  </div>

  {#if !isAdmin}
    {#if currentView === "selection"}
      <!-- Card Selection View -->
      <div class="max-w-7xl mx-auto" in:fade={{ duration: 300 }}>
        <!-- Form Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Leave Request Card -->
          <button
            on:click={() => {
              currentView = "leave";
              activeForm = "leave";
            }}
            class="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 border-transparent hover:border-[#3A7AE0]/30 text-left"
            in:fly={{ y: 20, duration: 600, delay: 100, easing: quintOut }}
          >
            <div
              class="bg-linear-to-br from-[#3A7AE0] to-[#1A4786] p-5 rounded-2xl mb-6 inline-block shadow-lg group-hover:scale-110 transition-transform duration-300"
            >
              <svg
                class="w-10 h-10 text-white"
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
            </div>
            <h3 class="text-2xl font-bold text-[#1A4786] mb-3">
              Permohonan Cuti
            </h3>
            <p class="text-gray-600 leading-relaxed">
              Cuti tahunan, sakit, melahirkan, menikah, atau keluarga meninggal
            </p>
          </button>

          <!-- Overtime Request Card -->
          <button
            on:click={() => {
              currentView = "overtime";
              activeForm = "overtime";
            }}
            class="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 border-transparent hover:border-[#FFD700]/30 text-left"
            in:fly={{ y: 20, duration: 600, delay: 200, easing: quintOut }}
          >
            <div
              class="bg-linear-to-br from-[#FFD700] to-[#FFA500] p-5 rounded-2xl mb-6 inline-block shadow-lg group-hover:scale-110 transition-transform duration-300"
            >
              <svg
                class="w-10 h-10 text-white"
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
            <h3 class="text-2xl font-bold text-[#1A4786] mb-3">
              Surat Perintah Lembur
            </h3>
            <p class="text-gray-600 leading-relaxed">Kirim jam kerja lembur</p>
          </button>

          <!-- Permission Request Card -->
          <button
            on:click={() => (currentView = "permission")}
            class="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 border-transparent hover:border-[#3A7AE0]/30 text-left"
            in:fly={{ y: 20, duration: 600, delay: 300, easing: quintOut }}
          >
            <div
              class="bg-linear-to-br from-[#3A7AE0] to-[#1A4786] p-5 rounded-2xl mb-6 inline-block shadow-lg group-hover:scale-110 transition-transform duration-300"
            >
              <svg
                class="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-[#1A4786] mb-3">
              Formulir Ijin
            </h3>
            <p class="text-gray-600 leading-relaxed">
              Izin terlambat, pulang awal, atau sakit
            </p>
          </button>
        </div>
      </div>
    {:else if currentView === "leave" || currentView === "overtime"}
      <div
        class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        in:fly={{ y: 20, duration: 600, delay: 100, easing: quintOut }}
      >
        <div class="p-8">
          {#if activeForm === "leave"}
            <!-- Leave Request Form -->
            <form
              on:submit|preventDefault={submitLeaveRequest}
              class="space-y-6"
              in:fade={{ duration: 200 }}
            >
              <!-- Leave Type Dropdown -->
              <div class="space-y-2">
                <label
                  for="leaveType"
                  class="block text-sm font-semibold text-[#1A4786]"
                >
                  {t.leaveType || "Jenis Cuti Yang Diajukan"} *
                </label>
                <select
                  id="leaveType"
                  bind:value={leaveForm.type}
                  required
                  class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%236b7280%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-size-[1.5em_1.5em] bg-position-[right_0.5rem_center] bg-no-repeat pr-10"
                >
                  <option value="" disabled selected
                    >{t.selectLeaveType || "Pilih jenis cuti"}</option
                  >
                  <option value="annual"
                    >{t.annualLeave || "Cuti Tahunan"}</option
                  >
                  <option value="sick">{t.sickLeave || "Cuti Sakit"}</option>
                  <option value="emergency"
                    >{t.emergencyLeave || "Cuti Darurat"}</option
                  >
                  <option value="other">{t.other || "Lainnya"}</option>
                </select>
              </div>

              <!-- Date Range Fields -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="space-y-2">
                  <label
                    for="startDate"
                    class="block text-sm font-semibold text-[#1A4786]"
                  >
                    {t.startDate || "Tanggal Mulai"} *
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    bind:value={leaveForm.startDate}
                    on:change={calculateLeaveDays}
                    required
                    class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300"
                  />
                </div>

                <div class="space-y-2">
                  <label
                    for="endDate"
                    class="block text-sm font-semibold text-[#1A4786]"
                  >
                    {t.endDate || "Tanggal Selesai"} *
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    bind:value={leaveForm.endDate}
                    on:change={calculateLeaveDays}
                    required
                    class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300"
                  />
                </div>

                <div class="space-y-2">
                  <label
                    for="totalDays"
                    class="block text-sm font-semibold text-[#1A4786]"
                  >
                    {t.totalDays || "Total Hari Cuti"}
                  </label>
                  <div
                    class="w-full px-4 py-3 bg-blue-100 border-2 border-blue-200 rounded-xl text-[#1A4786] font-bold text-center text-lg"
                  >
                    {leaveForm.totalDays || 0}
                  </div>
                </div>
              </div>

              <!-- Reason Field -->
              <div class="space-y-2">
                <label
                  for="leaveReason"
                  class="block text-sm font-semibold text-[#1A4786]"
                >
                  {t.reason || "Keperluan"} *
                </label>
                <textarea
                  id="leaveReason"
                  bind:value={leaveForm.reason}
                  required
                  rows="4"
                  placeholder={t.reasonPlaceholder ||
                    "Mohon jelaskan keperluan cuti Anda..."}
                  class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300 resize-none"
                ></textarea>
              </div>

              <!-- Info Box -->
              <div
                class="p-4 bg-blue-50 border-l-4 border-[#3A7AE0] rounded-lg"
              >
                <p class="text-sm text-[#1A4786]">
                  {t.leaveNote ||
                    "Keterangan: Permintaan cuti minimal 7 hari sebelumnya."}
                </p>
              </div>

              <!-- Submit Button -->
              <button
                type="submit"
                disabled={loading}
                class="w-full px-6 py-4 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative overflow-hidden group"
              >
                <div
                  class="absolute inset-0 bg-linear-to-rrom-[#FFD700]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                ></div>
                <div
                  class="flex items-center justify-center gap-3 relative z-10"
                >
                  {#if loading}
                    <svg
                      class="animate-spin h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
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
                    <span>{t.submitting || "Mengirim..."}</span>
                  {:else}
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>{t.submit || "Kirim Permohonan"}</span>
                  {/if}
                </div>
              </button>
            </form>
          {:else}
            <!-- Overtime Request Form -->
            <form
              on:submit|preventDefault={submitOvertimeRequest}
              class="space-y-6"
              in:fade={{ duration: 200 }}
            >
              <!-- Overtime Date -->
              <div class="space-y-2">
                <label
                  for="otDate"
                  class="block text-sm font-semibold text-[#1A4786]"
                >
                  {t.overtimeDate || "Overtime Date"} *
                </label>
                <input
                  id="otDate"
                  type="date"
                  bind:value={overtimeForm.date}
                  required
                  class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300"
                />
              </div>

              <!-- Time Range and Total Hours -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="space-y-2">
                  <label
                    for="startTime"
                    class="block text-sm font-semibold text-[#1A4786]"
                  >
                    {t.startTime || "Start Time"} *
                  </label>
                  <input
                    id="startTime"
                    type="time"
                    bind:value={overtimeForm.startTime}
                    on:change={calculateTotalHours}
                    required
                    class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300"
                  />
                </div>

                <div class="space-y-2">
                  <label
                    for="endTime"
                    class="block text-sm font-semibold text-[#1A4786]"
                  >
                    {t.endTime || "End Time"} *
                  </label>
                  <input
                    id="endTime"
                    type="time"
                    bind:value={overtimeForm.endTime}
                    on:change={calculateTotalHours}
                    required
                    class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300"
                  />
                </div>

                <div class="space-y-2">
                  <label
                    for="totalHours"
                    class="block text-sm font-semibold text-[#1A4786]"
                  >
                    {t.totalHours || "Total Hours"}
                  </label>
                  <div
                    class="w-full px-4 py-3 bg-yellow-100 border-2 border-yellow-300 rounded-xl text-[#1A4786] font-bold text-center text-lg"
                  >
                    {overtimeForm.totalHours || 0}
                  </div>
                </div>
              </div>

              <!-- Work Description -->
              <div class="space-y-2">
                <label
                  for="otWorkDesc"
                  class="block text-sm font-semibold text-[#1A4786]"
                >
                  {t.workDescription || "Work Description"} *
                </label>
                <textarea
                  id="otWorkDesc"
                  bind:value={overtimeForm.workDescription}
                  required
                  rows="4"
                  placeholder={t.workDescPlaceholder ||
                    "Describe the work or task performed..."}
                  class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300 resize-none"
                ></textarea>
              </div>

              <!-- Submit Button -->
              <button
                type="submit"
                disabled={loading}
                class="w-full px-6 py-4 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative overflow-hidden group"
              >
                <div
                  class="absolute inset-0 bg-linear-to-r from-[#FFD700]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                ></div>
                <div
                  class="flex items-center justify-center gap-3 relative z-10"
                >
                  {#if loading}
                    <svg
                      class="animate-spin h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
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
                    <span>{t.submitting || "Mengirim..."}</span>
                  {:else}
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>{t.submit || "Kirim Permohonan"}</span>
                  {/if}
                </div>
              </button>
            </form>
          {/if}
        </div>
      </div>

      <div class="mb-6">
        <button
          on:click={() => (currentView = "selection")}
          class="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Kembali
        </button>
      </div>
    {:else if currentView === "permission"}
      <!-- Permission Form -->
      <form
        on:submit|preventDefault={submitPermissionRequest}
        class="space-y-6"
        in:fade={{ duration: 200 }}
      >
        <!-- Permission Type Dropdown -->
        <div class="space-y-2">
          <label
            for="permissionType"
            class="block text-sm font-semibold text-[#1A4786]"
          >
            {t.permissionType || "Permission Type"} *
          </label>
          <select
            id="permissionType"
            bind:value={permissionForm.type}
            required
            class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%236b7280%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-size-[1.5em_1.5em] bg-position-[right_0.5rem_center] bg-no-repeat pr-10"
          >
            <option value="" disabled selected
              >{t.selectPermissionType || "Select permission type"}</option
            >
            <option value="late">{t.lateArrival || "Terlambat"}</option>
            <option value="early">{t.earlyLeave || "Pulang Cepat"}</option>
            <option value="sick">{t.sick || "Sakit"}</option>
            <option value="other">{t.other || "Lainnya"}</option>
          </select>
        </div>

        <!-- Date Field -->
        <div class="space-y-2">
          <label
            for="permissionDate"
            class="block text-sm font-semibold text-[#1A4786]"
          >
            {t.date || "Date"} *
          </label>
          <input
            id="permissionDate"
            type="date"
            bind:value={permissionForm.date}
            required
            class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300"
          />
        </div>

        <!-- Details/Purpose Field -->
        <div class="space-y-2">
          <label
            for="permissionDetails"
            class="block text-sm font-semibold text-[#1A4786]"
          >
            {t.detailsOfPurpose || "Details of Purpose"} *
          </label>
          <textarea
            id="permissionDetails"
            bind:value={permissionForm.details}
            required
            rows="4"
            placeholder={t.detailsPlaceholder || "Please provide details..."}
            class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium hover:border-gray-300 resize-none"
          ></textarea>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          disabled={loading}
          class="w-full px-6 py-4 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative overflow-hidden group"
        >
          <div
            class="absolute inset-0 bg-linear-to-r from-[#FFD700]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
          ></div>
          <div class="flex items-center justify-center gap-3 relative z-10">
            {#if loading}
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
              <span>{t.submitting || "Mengirim..."}</span>
            {:else}
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{t.submit || "Kirim Permohonan"}</span>
            {/if}
          </div>
        </button>
      </form>
    {/if}
  {/if}

  <!-- Submissions List -->
  <div
    class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
    in:fly={{ y: 20, duration: 600, delay: 200, easing: quintOut }}
  >
    <div
      class="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-linear-to-r from-[#F8F8F8] to-white"
    >
      <div>
        <h2 class="text-xl font-bold text-[#1A4786] flex items-center gap-2">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {isAdmin ? t.allSubmissions : t.mySubmissions}
        </h2>
        <p class="text-sm text-gray-600 mt-1">
          {filteredSubmissions.length}
          {filteredSubmissions.length === 1 ? "submission" : "submissions"}
        </p>
      </div>
      <button
        on:click={loadSubmissions}
        class="px-6 py-3 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] hover:shadow-lg hover:scale-105 text-white rounded-xl font-semibold transition-all flex items-center gap-2"
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
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {t.refresh}
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="px-6 pt-4 border-b border-gray-200 bg-[#F8F8F8]">
      <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          on:click={() => (activeFilter = "all")}
          class="px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all {activeFilter ===
          'all'
            ? 'bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white shadow-md'
            : 'bg-white text-gray-600 hover:bg-gray-100'}"
        >
          {t.allSubmissions}
          <span
            class="ml-2 px-2 py-0.5 rounded-full text-xs font-bold {activeFilter ===
            'all'
              ? 'bg-white/20'
              : 'bg-gray-200'}"
          >
            {submissions.length}
          </span>
        </button>
        <button
          on:click={() => (activeFilter = "pending")}
          class="px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all {activeFilter ===
          'pending'
            ? 'bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white shadow-md'
            : 'bg-white text-gray-600 hover:bg-gray-100'}"
        >
          {t.pendingSubmissions}
          <span
            class="ml-2 px-2 py-0.5 rounded-full text-xs font-bold {activeFilter ===
            'pending'
              ? 'bg-white/20'
              : 'bg-amber-200 text-amber-800'}"
          >
            {submissions.filter(
              (s) => s.status === "pending" || s.status === "approved_by_admin"
            ).length}
          </span>
        </button>
        <button
          on:click={() => (activeFilter = "approved")}
          class="px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all {activeFilter ===
          'approved'
            ? 'bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white shadow-md'
            : 'bg-white text-gray-600 hover:bg-gray-100'}"
        >
          {t.approvedSubmissions}
          <span
            class="ml-2 px-2 py-0.5 rounded-full text-xs font-bold {activeFilter ===
            'approved'
              ? 'bg-white/20'
              : 'bg-green-200 text-green-800'}"
          >
            {submissions.filter((s) => s.status === "approved").length}
          </span>
        </button>
        <button
          on:click={() => (activeFilter = "rejected")}
          class="px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all {activeFilter ===
          'rejected'
            ? 'bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white shadow-md'
            : 'bg-white text-gray-600 hover:bg-gray-100'}"
        >
          {t.rejectedSubmissions}
          <span
            class="ml-2 px-2 py-0.5 rounded-full text-xs font-bold {activeFilter ===
            'rejected'
              ? 'bg-white/20'
              : 'bg-red-200 text-red-800'}"
          >
            {submissions.filter((s) => s.status === "rejected").length}
          </span>
        </button>
      </div>
    </div>

    <div class="p-6">
      {#if loading}
        <div class="flex flex-col items-center justify-center py-20">
          <div
            class="w-16 h-16 border-4 border-[#F8F8F8] border-t-[#3A7AE0] rounded-full animate-spin"
          ></div>
          <p class="mt-4 text-gray-500 font-medium">{t.loading}</p>
        </div>
      {:else if filteredSubmissions.length === 0}
        <div class="text-center py-20" in:fade={{ duration: 300 }}>
          <div
            class="w-20 h-20 bg-linear-to-br from-[#F8F8F8] to-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner"
          >
            <svg
              class="w-10 h-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <p class="text-gray-500 font-medium">{t.noSubmissions}</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each filteredSubmissions as submission, i}
            <div
              class="border-2 border-gray-100 rounded-2xl p-6 hover:shadow-md hover:border-[#3A7AE0]/30 transition-all bg-linear-to-r from-white to-[#F8F8F8]/30"
              in:fly={{ y: 20, duration: 400, delay: i * 50, easing: quintOut }}
            >
              <div
                class="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4"
              >
                <div class="flex-1">
                  <div class="flex flex-wrap items-center gap-2 mb-3">
                    <span
                      class="px-3 py-1.5 text-xs font-bold bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white rounded-full shadow-sm uppercase tracking-wide"
                    >
                      {submission.type === "leave"
                        ? t.leaveRequest
                        : t.overtimeRequest}
                    </span>
                    <span
                      class="px-3 py-1.5 text-xs font-bold rounded-full uppercase tracking-wide shadow-sm border-2 {submission.status ===
                      'approved'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : submission.status === 'rejected'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : submission.status === 'approved_by_admin'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'}"
                    >
                      {submission.status === "approved"
                        ? t.approved
                        : submission.status === "rejected"
                          ? t.rejected
                          : submission.status === "approved_by_admin"
                            ? "Waiting Direktur"
                            : t.pending}
                    </span>
                  </div>

                  <div class="space-y-2 mb-4">
                    <div class="flex items-center gap-2 text-[#1A4786]">
                      <svg
                        class="w-4 h-4 text-[#FFD700]"
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
                      <span class="font-bold">{submission.userName}</span>
                      <span class="text-gray-500 text-sm"
                        >({submission.userNik})</span
                      >
                    </div>
                    <div class="flex items-center gap-2 text-gray-600 text-sm">
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
                        >{t.submitted}: {formatDate(submission.createdAt)}</span
                      >
                    </div>
                  </div>

                  <div
                    class="bg-white rounded-xl p-4 space-y-3 border border-gray-100"
                  >
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <span
                          class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                          >{t.date}</span
                        >
                        <p class="text-sm font-bold text-[#1A4786] mt-1">
                          {submission.date}
                        </p>
                      </div>
                      {#if submission.type === "overtime"}
                        <div>
                          <span
                            class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                            >{t.duration}</span
                          >
                          <p class="text-sm font-bold text-[#1A4786] mt-1">
                            {submission.duration}
                            {t.hours}
                          </p>
                        </div>
                      {/if}
                    </div>

                    {#if submission.type === "overtime"}
                      <div>
                        <span
                          class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                          >{t.workDescription}</span
                        >
                        <p class="text-sm text-gray-700 mt-1">
                          {submission.workDescription}
                        </p>
                      </div>
                    {/if}

                    {#if submission.type === "leave"}
                      <div>
                        <span
                          class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                          >{t.type}</span
                        >
                        <div class="flex flex-wrap gap-2 mt-2">
                          {#if submission.lateArrival}
                            <span
                              class="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg"
                              >{t.lateArrival}</span
                            >
                          {/if}
                          {#if submission.sick}
                            <span
                              class="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg"
                              >{t.sickLeave}</span
                            >
                          {/if}
                          {#if submission.earlyLeave}
                            <span
                              class="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg"
                              >{t.earlyLeave}</span
                            >
                          {/if}
                          {#if submission.other}
                            <span
                              class="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg"
                              >{t.other}</span
                            >
                          {/if}
                        </div>
                      </div>
                    {/if}

                    <div>
                      <span
                        class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                        >{t.reason}</span
                      >
                      <p class="text-sm text-gray-700 mt-1">
                        {submission.reason}
                      </p>
                    </div>

                    {#if submission.approvedBy}
                      <div class="pt-3 border-t border-gray-200">
                        <p class="text-xs text-gray-500">
                          {submission.status === "approved"
                            ? t.approved
                            : t.rejected}
                          {t.approvedBy}
                          <span class="font-semibold text-[#1A4786]"
                            >{submission.approvedBy}</span
                          >
                        </p>
                      </div>
                    {/if}

                    {#if submission.approvedByAdmin}
                      <div class="pt-3 border-t border-gray-200">
                        <p class="text-xs text-gray-500">
                          Admin approved {t.approvedBy}
                          <span class="font-semibold text-[#1A4786]"
                            >{submission.approvedByAdmin}</span
                          >
                        </p>
                      </div>
                    {/if}

                    {#if submission.approvedByDirektur}
                      <div class="pt-3 border-t border-gray-200">
                        <p class="text-xs text-gray-500">
                          Direktur approved {t.approvedBy}
                          <span class="font-semibold text-[#1A4786]"
                            >{submission.approvedByDirektur}</span
                          >
                        </p>
                      </div>
                    {/if}

                    {#if submission.rejectedBy}
                      <div class="pt-3 border-t border-gray-200">
                        <p class="text-xs text-red-600">
                          Rejected {t.approvedBy}
                          <span class="font-semibold"
                            >{submission.rejectedBy}</span
                          >
                        </p>
                      </div>
                    {/if}
                  </div>
                </div>

                {#if isAdmin && submission.status === "pending"}
                  <div class="flex lg:flex-col gap-2">
                    <button
                      on:click={() => updateStatus(submission.id, "approved")}
                      disabled={loading}
                      class="flex-1 lg:flex-none px-6 py-3 bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105"
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
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {t.approve}
                    </button>
                    <button
                      on:click={() => updateStatus(submission.id, "rejected")}
                      disabled={loading}
                      class="flex-1 lg:flex-none px-6 py-3 bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      {t.reject}
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>
