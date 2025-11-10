<script>
  import { onMount } from "svelte";
  import {
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    orderBy,
  } from "firebase/firestore";
  import { db } from "../services/firebase";
  import { authStore } from "../../stores/auth";
  import { writable } from "svelte/store";

  export let language = writable("en");

  const translations = {
    en: {
      title: "Submit Forms",
      subtitle: "Request leave, overtime, or special permission",
      mySubmissions: "My Submissions",
      viewAll: "View All",
      selectFormType: "Select Form Type",
      leaveRequest: "Leave Application",
      leaveSubtitle: "Annual, sick, maternity, marriage, or bereavement leave",
      leaveType: "Type of Leave",
      selectLeaveType: "Select leave type",
      annual: "Annual Leave",
      sick: "Sick Leave",
      maternity: "Maternity Leave",
      marriage: "Marriage Leave",
      bereavement: "Bereavement Leave",
      other: "Other",
      startDate: "Start Date",
      endDate: "End Date",
      totalDays: "Total Days",
      purpose: "Purpose",
      purposePlaceholder: "Please describe the purpose of your leave...",
      noteLeave:
        "Note: Leave requests must be submitted at least 7 days in advance.",
      overtimeRequest: "Overtime Order",
      overtimeSubtitle: "Submit overtime work hours",
      overtimeDate: "Overtime Date",
      startTime: "Start Time",
      endTime: "End Time",
      hours: "Total Hours",
      description: "Work Description",
      descriptionPlaceholder: "Describe the work or task performed...",
      permissionRequest: "Permission Form",
      permissionSubtitle: "Late arrival, early leave, or sick permission",
      permissionType: "Permission Type",
      selectPermissionType: "Select permission type",
      lateArrival: "Late for Work",
      earlyLeave: "Leave Early",
      sickPermission: "Sick",
      otherPermission: "Other",
      permissionDate: "Date",
      detailsPurpose: "Details of Purpose",
      detailsPlaceholder: "Please provide details...",
      employeeName: "Employee Name",
      department: "Department",
      employeeNo: "Employee No.",
      position: "Position",
      submit: "Submit Request",
      submitting: "Submitting...",
      cancel: "Back",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      successTitle: "Request Submitted!",
      successMessage: "Your request has been submitted successfully.",
      errorTitle: "Submission Failed",
      errorMessage: "There was an error. Please try again.",
      close: "Close",
      noSubmissions: "No submissions yet",
      submittedOn: "Submitted on",
    },
    id: {
      title: "Kirim Formulir",
      subtitle: "Ajukan cuti, lembur, atau izin khusus",
      mySubmissions: "Pengajuan Saya",
      viewAll: "Lihat Semua",
      selectFormType: "Pilih Jenis Formulir",
      leaveRequest: "Permohonan Cuti",
      leaveSubtitle:
        "Cuti tahunan, sakit, melahirkan, menikah, atau keluarga meninggal",
      leaveType: "Jenis Cuti Yang Diajukan",
      selectLeaveType: "Pilih jenis cuti",
      annual: "Cuti Tahunan",
      sick: "Cuti Sakit",
      maternity: "Cuti Melahirkan",
      marriage: "Cuti Menikah",
      bereavement: "Cuti Keluarga Meninggal",
      other: "Lainnya",
      startDate: "Tanggal Mulai",
      endDate: "Tanggal Selesai",
      totalDays: "Total Hari Cuti",
      purpose: "Keperluan",
      purposePlaceholder: "Mohon jelaskan keperluan cuti Anda...",
      noteLeave: "Keterangan: Permintaan cuti minimal 7 hari sebelumnya.",
      overtimeRequest: "Surat Perintah Lembur",
      overtimeSubtitle: "Kirim jam kerja lembur",
      overtimeDate: "Tanggal Lembur",
      startTime: "Jam Mulai",
      endTime: "Jam Selesai",
      hours: "Total Jam",
      description: "Keterangan Pekerjaan",
      descriptionPlaceholder: "Jelaskan pekerjaan yang dilakukan...",
      permissionRequest: "Formulir Ijin",
      permissionSubtitle: "Izin terlambat, pulang awal, atau sakit",
      permissionType: "Jenis Ijin",
      selectPermissionType: "Pilih jenis ijin",
      lateArrival: "Terlambat Masuk Kerja",
      earlyLeave: "Pulang Lebih Awal",
      sickPermission: "Sakit",
      otherPermission: "Lainnya",
      permissionDate: "Tanggal",
      detailsPurpose: "Rincian Keperluan",
      detailsPlaceholder: "Mohon berikan rincian...",
      employeeName: "Nama",
      department: "Departemen",
      employeeNo: "No Karyawan",
      position: "Jabatan",
      submit: "Kirim Pengajuan",
      submitting: "Mengirim...",
      cancel: "Kembali",
      pending: "Menunggu",
      approved: "Disetujui",
      rejected: "Ditolak",
      successTitle: "Pengajuan Berhasil!",
      successMessage: "Pengajuan Anda telah berhasil dikirim.",
      errorTitle: "Pengajuan Gagal",
      errorMessage: "Terjadi kesalahan. Silakan coba lagi.",
      close: "Tutup",
      noSubmissions: "Belum ada pengajuan",
      submittedOn: "Diajukan pada",
    },
  };

  $: t = translations[$language];
  $: userId = $authStore.userData?.id;
  $: userName = $authStore.userData?.name;
  $: userDepartment = $authStore.userData?.job || "N/A";
  $: userEmployeeNo = $authStore.userData?.nik || "N/A";
  $: userPosition = $authStore.userData?.site || "N/A";

  let mounted = false;
  let formType = "";
  let recentSubmissions = [];
  let leaveType = "";
  let leaveOtherType = "";
  let startDate = "";
  let endDate = "";
  let purpose = "";
  let overtimeDate = "";
  let startTime = "";
  let endTime = "";
  let description = "";
  let permissionType = "";
  let permissionOtherType = "";
  let permissionDate = "";
  let detailsPurpose = "";
  let loading = false;
  let loadingSubmissions = true;
  let showSuccess = false;
  let showError = false;

  onMount(() => {
    mounted = true;
    if (userId) loadRecentSubmissions();
  });

  $: if (mounted && userId) loadRecentSubmissions();
  $: totalHours = calculateHours(startTime, endTime);
  $: totalDays = calculateDays(startDate, endDate);

  function calculateHours(start, end) {
    if (!start || !end) return 0;
    const s = new Date(`2000-01-01T${start}`);
    const e = new Date(`2000-01-01T${end}`);
    const diff = Number(e) - Number(s);
    const hours = diff / (1000 * 60 * 60);
    return hours > 0 ? Number(hours.toFixed(1)) : 0;
  }

  function calculateDays(start, end) {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diff = Number(e) - Number(s);
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    return days > 0 ? days : 0;
  }

  async function loadRecentSubmissions() {
    if (!userId) return;
    loadingSubmissions = true;
    try {
      const formsRef = collection(db, "forms");
      const q = query(
        formsRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      recentSubmissions = snapshot.docs
        .slice(0, 3)
        .map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error loading submissions:", error);
    } finally {
      loadingSubmissions = false;
    }
  }

  function resetForm() {
    formType = "";
    leaveType = "";
    leaveOtherType = "";
    startDate = "";
    endDate = "";
    purpose = "";
    overtimeDate = "";
    startTime = "";
    endTime = "";
    description = "";
    permissionType = "";
    permissionOtherType = "";
    permissionDate = "";
    detailsPurpose = "";
  }

  async function handleSubmit() {
    if (!userId) return;
    loading = true;
    try {
      const formData = {
        userId,
        userName,
        userDepartment,
        userEmployeeNo,
        userPosition,
        type: formType,
        status: "pending",
        submissionDate: new Date().toISOString().split("T")[0],
        createdAt: serverTimestamp(),
      };

      if (formType === "leave") {
        formData.leaveType = leaveType === "other" ? leaveOtherType : leaveType;
        formData.startDate = startDate;
        formData.endDate = endDate;
        formData.totalDays = totalDays;
        formData.purpose = purpose;
      } else if (formType === "overtime") {
        formData.overtimeDate = overtimeDate;
        formData.startTime = startTime;
        formData.endTime = endTime;
        formData.totalHours = totalHours;
        formData.description = description;
      } else if (formType === "permission") {
        formData.permissionType =
          permissionType === "other" ? permissionOtherType : permissionType;
        formData.permissionDate = permissionDate;
        formData.detailsPurpose = detailsPurpose;
      }

      await addDoc(collection(db, "forms"), formData);
      showSuccess = true;
      resetForm();
      loadRecentSubmissions();
    } catch (error) {
      console.error("Error submitting form:", error);
      showError = true;
    } finally {
      loading = false;
    }
  }

  function isFormValid() {
    if (formType === "leave") {
      const hasLeaveType =
        leaveType && (leaveType !== "other" || leaveOtherType.trim());
      return (
        hasLeaveType && startDate && endDate && purpose.trim() && totalDays > 0
      );
    } else if (formType === "overtime") {
      return (
        overtimeDate &&
        startTime &&
        endTime &&
        description.trim() &&
        totalHours > 0
      );
    } else if (formType === "permission") {
      const hasPermissionType =
        permissionType &&
        (permissionType !== "other" || permissionOtherType.trim());
      return hasPermissionType && permissionDate && detailsPurpose.trim();
    }
    return false;
  }

  function getStatusColor(status) {
    if (status === "approved")
      return "bg-green-100 text-green-700 border-green-300";
    if (status === "rejected") return "bg-red-100 text-red-700 border-red-300";
    return "bg-yellow-100 text-yellow-700 border-yellow-300";
  }

  function getFormTypeLabel(type) {
    if (type === "leave") return t.leaveRequest;
    if (type === "overtime") return t.overtimeRequest;
    if (type === "permission") return t.permissionRequest;
    return type;
  }

  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString($language === "id" ? "id-ID" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  function toggleLanguage() {
    language.update((lang) => (lang === "en" ? "id" : "en"));
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
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    @keyframes shimmer {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }
    .animate-slide-in-up {
      animation: slideInUp 0.4s ease-out forwards;
    }
    .animate-fade-in {
      animation: fadeIn 0.3s ease-out forwards;
    }
    .animate-scale-in {
      animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    .input-focus-ring {
      transition: all 0.2s ease;
    }
    .input-focus-ring:focus-within {
      transform: translateY(-2px);
    }
    .shimmer-effect::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 215, 0, 0.3),
        transparent
      );
      animation: shimmer 2s infinite;
    }
    .delay-100 {
      animation-delay: 0.1s;
    }
    .delay-200 {
      animation-delay: 0.2s;
    }
  </style>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
  <!-- Language Toggle -->
  <div class="flex justify-end {mounted ? 'animate-fade-in' : 'opacity-0'}">
    <button
      on:click={toggleLanguage}
      class="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-all"
    >
      <svg
        class="w-5 h-5 text-gray-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
        />
      </svg>
      <span class="text-sm font-medium text-gray-700">
        {$language === "en" ? "English" : "Bahasa"}
      </span>
    </button>
  </div>

  <div
    class="bg-linear-to-r from-[#1A4786] to-[#3A7AE0] rounded-2xl shadow-lg p-8 text-white relative overflow-hidden {mounted
      ? 'animate-slide-in-up'
      : 'opacity-0'}"
  >
    <div
      class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"
    ></div>
    <div class="relative z-10 flex items-center gap-3">
      <div
        class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <div>
        <h1 class="text-2xl font-bold">{t.title}</h1>
        <p class="text-sm text-white/80">{t.subtitle}</p>
      </div>
    </div>
  </div>

  {#if !formType && recentSubmissions.length > 0}
    <div
      class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 {mounted
        ? 'animate-fade-in delay-100'
        : 'opacity-0'}"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-[#1A4786]">{t.mySubmissions}</h2>
      </div>
      <div class="space-y-3">
        {#each recentSubmissions as submission}
          <div
            class="flex items-center justify-between p-4 bg-[#F8F8F8] rounded-xl"
          >
            <div>
              <h3 class="font-semibold text-[#1A4786]">
                {getFormTypeLabel(submission.type)}
              </h3>
              <p class="text-xs text-gray-500">
                {t.submittedOn}
                {formatDate(submission.submissionDate)}
              </p>
            </div>
            <span
              class="px-3 py-1 rounded-lg text-xs font-semibold border {getStatusColor(
                submission.status
              )}"
            >
              {submission.status === "pending"
                ? t.pending
                : submission.status === "approved"
                  ? t.approved
                  : t.rejected}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if !formType}
    <div
      class="grid grid-cols-1 md:grid-cols-3 gap-4 {mounted
        ? 'animate-fade-in delay-200'
        : 'opacity-0'}"
    >
      <button
        on:click={() => (formType = "leave")}
        class="group bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-[#3A7AE0] transition-all shadow-sm hover:shadow-lg relative overflow-hidden"
      >
        <div
          class="absolute inset-0 bg-linear-to-br from-[#3A7AE0]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
        ></div>
        <div class="relative z-10">
          <div
            class="w-14 h-14 bg-linear-to-br from-[#1A4786] to-[#3A7AE0] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-[#1A4786] mb-2">
            {t.leaveRequest}
          </h3>
          <p class="text-xs text-gray-600">{t.leaveSubtitle}</p>
        </div>
      </button>

      <button
        on:click={() => (formType = "overtime")}
        class="group bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-[#FFD700] transition-all shadow-sm hover:shadow-lg relative overflow-hidden"
      >
        <div
          class="absolute inset-0 bg-linear-to-br from-[#FFD700]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
        ></div>
        <div class="relative z-10">
          <div
            class="w-14 h-14 bg-linear-to-br from-[#FFD700] to-[#FFA500] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-[#1A4786] mb-2">
            {t.overtimeRequest}
          </h3>
          <p class="text-xs text-gray-600">{t.overtimeSubtitle}</p>
        </div>
      </button>

      <button
        on:click={() => (formType = "permission")}
        class="group bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-[#3A7AE0] transition-all shadow-sm hover:shadow-lg relative overflow-hidden"
      >
        <div
          class="absolute inset-0 bg-linear-to-br from-[#3A7AE0]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
        ></div>
        <div class="relative z-10">
          <div
            class="w-14 h-14 bg-linear-to-br from-[#1A4786] to-[#3A7AE0] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-[#1A4786] mb-2">
            {t.permissionRequest}
          </h3>
          <p class="text-xs text-gray-600">{t.permissionSubtitle}</p>
        </div>
      </button>
    </div>
  {:else}
    <div
      class="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 {mounted
        ? 'animate-scale-in'
        : 'opacity-0'}"
    >
      <div
        class="flex items-center justify-between mb-6 pb-6 border-b-2 border-gray-100"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 bg-linear-to-br from-[#1A4786] to-[#3A7AE0] rounded-xl flex items-center justify-center"
          >
            <svg
              class="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {#if formType === "leave"}
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              {:else if formType === "overtime"}
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              {:else}
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              {/if}
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-[#1A4786]">
              {getFormTypeLabel(formType)}
            </h2>
            <p class="text-xs text-gray-500">SUMBER SARANA SOLUSINDO</p>
          </div>
        </div>
        <button
          on:click={resetForm}
          class="px-4 py-2 text-sm text-gray-600 hover:text-[#1A4786] hover:bg-gray-50 rounded-lg transition-all flex items-center gap-2"
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
          {t.cancel}
        </button>
      </div>

      <div
        class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-4 bg-[#F8F8F8] rounded-xl"
      >
        <div>
          <p class="text-xs text-gray-500 mb-1">{t.employeeName}</p>
          <p class="font-semibold text-[#1A4786] text-sm">{userName}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1">{t.department}</p>
          <p class="font-semibold text-[#1A4786] text-sm">{userDepartment}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1">{t.employeeNo}</p>
          <p class="font-semibold text-[#1A4786] text-sm">{userEmployeeNo}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1">{t.position}</p>
          <p class="font-semibold text-[#1A4786] text-sm">{userPosition}</p>
        </div>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        {#if formType === "leave"}
          <div class="input-focus-ring">
            <label
              for="leave-type"
              class="block text-sm font-semibold text-[#1A4786] mb-2"
            >
              {t.leaveType}
              <span class="text-[#FFD700]" aria-hidden="true">*</span>
              <span class="sr-only">required</span>
            </label>
            <select
              bind:value={leaveType}
              required
              class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium"
            >
              <option value="">{t.selectLeaveType}</option>
              <option value="annual">{t.annual}</option>
              <option value="sick">{t.sick}</option>
              <option value="maternity">{t.maternity}</option>
              <option value="marriage">{t.marriage}</option>
              <option value="bereavement">{t.bereavement}</option>
              <option value="other">{t.other}</option>
            </select>
          </div>

          {#if leaveType === "other"}
            <div class="input-focus-ring">
              <input
                type="text"
                bind:value={leaveOtherType}
                required
                placeholder="Specify..."
                class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786]"
              />
            </div>
          {/if}

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Start Date -->
            <div class="input-focus-ring">
              <label
                for="start-date"
                class="block text-sm font-semibold text-[#1A4786] mb-2"
              >
                {t.startDate}
                <span class="text-[#FFD700]" aria-hidden="true">*</span>
                <span class="sr-only">required</span>
              </label>
              <input
                id="start-date"
                name="start-date"
                type="date"
                bind:value={startDate}
                required
                aria-required="true"
                class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786]"
              />
            </div>

            <!-- End Date -->
            <div class="input-focus-ring">
              <label
                for="end-date"
                class="block text-sm font-semibold text-[#1A4786] mb-2"
              >
                {t.endDate}
                <span class="text-[#FFD700]" aria-hidden="true">*</span>
                <span class="sr-only">required</span>
              </label>
              <input
                id="end-date"
                name="end-date"
                type="date"
                bind:value={endDate}
                required
                aria-required="true"
                class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786]"
              />
            </div>

            <!-- Total Days (Accessible Read-only Field) -->
            <div>
              <label
                for="total-days"
                class="block text-sm font-semibold text-[#1A4786] mb-2"
              >
                {t.totalDays}
              </label>
              <!-- svelte-ignore a11y_no_redundant_roles -->
              <output
                id="total-days"
                name="total-days"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                class="block w-full text-center px-4 py-3 bg-linear-to-r from-[#3A7AE0]/20 to-[#1A4786]/20 border-2 border-[#3A7AE0] rounded-xl text-2xl font-bold text-[#1A4786]"
              >
                {totalDays}
              </output>
            </div>
          </div>

          <div class="input-focus-ring">
            <label
              for="purpose"
              class="block text-sm font-semibold text-[#1A4786] mb-2"
            >
              {t.purpose} <span class="text-[#FFD700]">*</span>
            </label>
            <textarea
              id="purpose"
              bind:value={purpose}
              required
              rows="4"
              placeholder={t.purposePlaceholder}
              aria-required="true"
              aria-label={t.purpose}
              aria-describedby="purpose-description"
              class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] resize-none"
            ></textarea>
            <span id="purpose-description" class="sr-only">
              {t.purposePlaceholder}
            </span>
          </div>

          <div class="bg-blue-50 border-l-4 border-[#3A7AE0] p-4 rounded-lg">
            <p class="text-sm text-[#1A4786]">{t.noteLeave}</p>
          </div>
        {/if}

        {#if formType === "overtime"}
          <div class="input-focus-ring">
            <label
              for="overtimeDate"
              class="block text-sm font-semibold text-[#1A4786] mb-2"
              >{t.overtimeDate} <span class="text-[#FFD700]">*</span></label
            >
            <input
              id="overtimeDate"
              type="date"
              bind:value={overtimeDate}
              required
              aria-required="true"
              aria-label={t.overtimeDate}
              class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786]"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="input-focus-ring">
              <label
                for="startTime"
                class="block text-sm font-semibold text-[#1A4786] mb-2"
                >{t.startTime} <span class="text-[#FFD700]">*</span></label
              >
              <input
                id="startTime"
                type="time"
                bind:value={startTime}
                required
                aria-required="true"
                aria-label={t.startTime}
                class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786]"
              />
            </div>

            <div class="input-focus-ring">
              <label
                for="endTime"
                class="block text-sm font-semibold text-[#1A4786] mb-2"
                >{t.endTime} <span class="text-[#FFD700]">*</span></label
              >
              <input
                id="endTime"
                type="time"
                bind:value={endTime}
                required
                aria-required="true"
                aria-label={t.endTime}
                class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786]"
              />
            </div>

            <div>
              <label
                for="totalHours"
                class="block text-sm font-semibold text-[#1A4786] mb-2"
                >{t.hours}</label
              >
              <div
                id="totalHours"
                role="status"
                aria-live="polite"
                class="px-4 py-3 bg-linear-to-r from-[#FFD700]/20 to-[#FFA500]/20 border-2 border-[#FFD700] rounded-xl flex items-center justify-center"
              >
                <span class="text-2xl font-bold text-[#1A4786]"
                  >{totalHours}</span
                >
              </div>
            </div>
          </div>

          <div class="input-focus-ring">
            <label
              for="description"
              class="block text-sm font-semibold text-[#1A4786] mb-2"
              >{t.description} <span class="text-[#FFD700]">*</span></label
            >
            <textarea
              id="description"
              bind:value={description}
              required
              rows="4"
              placeholder={t.descriptionPlaceholder}
              aria-required="true"
              aria-label={t.description}
              aria-describedby="description-help"
              class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] resize-none"
            ></textarea>
            <span id="description-help" class="sr-only">
              {t.descriptionPlaceholder}
            </span>
          </div>
        {/if}

        {#if formType === "permission"}
          <div class="input-focus-ring">
            <label
              for="permissionType"
              class="block text-sm font-semibold text-[#1A4786] mb-2"
              >{t.permissionType} <span class="text-[#FFD700]">*</span></label
            >
            <select
              id="permissionType"
              bind:value={permissionType}
              required
              aria-required="true"
              aria-label={t.permissionType}
              class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] font-medium"
            >
              <option value="">{t.selectPermissionType}</option>
              <option value="late">{t.lateArrival}</option>
              <option value="early">{t.earlyLeave}</option>
              <option value="sick">{t.sickPermission}</option>
              <option value="other">{t.otherPermission}</option>
            </select>
          </div>

          {#if permissionType === "other"}
            <div class="input-focus-ring">
              <input
                type="text"
                bind:value={permissionOtherType}
                required
                placeholder="Specify..."
                class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786]"
              />
            </div>
          {/if}

          <div class="input-focus-ring">
            <label
              for="permissionDate"
              class="block text-sm font-semibold text-[#1A4786] mb-2"
            >
              {t.permissionDate} <span class="text-[#FFD700]">*</span>
            </label>
            <input
              id="permissionDate"
              type="date"
              bind:value={permissionDate}
              required
              aria-required="true"
              aria-label={t.permissionDate}
              class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786]"
            />
          </div>

          <div class="input-focus-ring">
            <label
              for="detailsPurpose"
              class="block text-sm font-semibold text-[#1A4786] mb-2"
            >
              {t.detailsPurpose} <span class="text-[#FFD700]">*</span>
            </label>
            <textarea
              id="detailsPurpose"
              bind:value={detailsPurpose}
              required
              rows="4"
              placeholder={t.detailsPlaceholder}
              aria-required="true"
              aria-label={t.detailsPurpose}
              aria-describedby="detailsPurpose-description"
              class="w-full px-4 py-3 bg-[#F8F8F8] border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:bg-white transition-all text-[#1A4786] resize-none"
            ></textarea>
            <span id="detailsPurpose-description" class="sr-only">
              {t.detailsPlaceholder}
            </span>
          </div>
        {/if}

        <div
          class="bg-linear-to-r from-[#F8F8F8] to-white border border-gray-200 rounded-xl p-5"
        >
          <h4
            class="text-sm font-bold text-[#1A4786] mb-3 flex items-center gap-2"
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Approval Flow
          </h4>
          <div class="flex items-center gap-2 text-xs text-gray-600">
            <span class="px-2 py-1 bg-[#FFD700] text-white rounded"
              >Employee</span
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
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span class="px-2 py-1 bg-gray-200 rounded">HRD</span>
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
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span class="px-2 py-1 bg-gray-200 rounded">Manager</span>
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
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span class="px-2 py-1 bg-gray-200 rounded">Director</span>
          </div>
        </div>

        <div class="flex gap-3 pt-4">
          <button
            type="button"
            on:click={resetForm}
            class="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={!isFormValid() || loading}
            class="flex-1 px-6 py-3 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
          >
            {#if loading}
              <div class="absolute inset-0 shimmer-effect"></div>
              <div class="flex items-center justify-center gap-2">
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
                <span>{t.submitting}</span>
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>{t.submit}</span>
              </div>
            {/if}
          </button>
        </div>
      </form>
    </div>
  {/if}

  {#if showSuccess}
    <div
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in"
      >
        <div
          class="w-16 h-16 bg-linear-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8 text-white"
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
        </div>
        <h3 class="text-2xl font-bold text-[#1A4786] text-center mb-2">
          {t.successTitle}
        </h3>
        <p class="text-gray-600 text-center mb-6">{t.successMessage}</p>
        <button
          on:click={() => (showSuccess = false)}
          class="w-full px-6 py-3 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white rounded-xl font-semibold hover:shadow-lg transition-all"
        >
          {t.close}
        </button>
      </div>
    </div>
  {/if}

  {#if showError}
    <div
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in"
      >
        <div
          class="w-16 h-16 bg-linear-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-[#1A4786] text-center mb-2">
          {t.errorTitle}
        </h3>
        <p class="text-gray-600 text-center mb-6">{t.errorMessage}</p>
        <button
          on:click={() => (showError = false)}
          class="w-full px-6 py-3 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white rounded-xl font-semibold hover:shadow-lg transition-all"
        >
          {t.close}
        </button>
      </div>
    </div>
  {/if}
</div>
