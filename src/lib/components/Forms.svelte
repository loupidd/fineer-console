<script>
  import { onMount, onDestroy } from "svelte";
  import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    Timestamp,
    query,
    where,
  } from "firebase/firestore";
  import { db } from "../services/firebase";
  import { authStore } from "../../stores/auth";
  import { fade, fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { translations } from "../i18n/translations";
  import companyLogo from "../../assets/companyLogo.webp";
  import { language } from "../../stores/language";

  $: t = translations[$language].Forms;

  // User authentication and role
  let isAdmin = false;
  let currentUserId = "";

  $: isAdmin =
    $authStore.userData?.role === "admin" ||
    $authStore.userData?.role === "direktur";
  $: currentUserId = $authStore.userData?.id;

  // View and filter states
  let activeForm = "leave";
  let currentView = "selection";
  let activeFilter = "all";
  let loading = false;
  let submissions = [];

  // Monthly report states
  let showMonthlyReportModal = false;
  let reportStartDate = "";
  let reportEndDate = "";
  let reportFormType = "all";

  // LEAVE FORM STATE
  let leaveForm = {
    type: "",
    startDate: "",
    endDate: "",
    totalDays: 0,
    reason: "",
    status: "pending",
  };

  // OVERTIME FORM STATE
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
  let permissionForm = {
    type: "",
    date: "",
    details: "",
    status: "pending",
  };

  // COMMENT MODAL STATE
  let commentModal = {
    show: false,
    formId: null,
    action: null, // 'approve' or 'reject'
    comment: "",
  };

  // CACHE MANAGEMENT
  let submissionsCache = {
    data: null,
    timestamp: null,
    userId: null,
  };
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache
  let refreshInterval = null;
  let lastUserId = null;

  // Initialize component
  onMount(() => {
    loadSubmissions();

    // Set default date range for report (21st of last month to 20th of current month)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Start date: 21st of previous month
    const startDate = new Date(currentYear, currentMonth - 1, 21);
    reportStartDate = startDate.toISOString().split("T")[0];

    // End date: 20th of current month
    const endDate = new Date(currentYear, currentMonth, 20);
    reportEndDate = endDate.toISOString().split("T")[0];

    // Set up periodic refresh every 2 minutes
    refreshInterval = setInterval(() => {
      if (currentUserId) {
        loadSubmissions(true); // Force refresh
      }
    }, CACHE_DURATION);
  });

  onDestroy(() => {
    // Clean up interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  // Helper function for manual refresh button click
  function handleRefreshClick() {
    loadSubmissions(true);
  }

  // LOAD SUBMISSIONS FROM FIRESTORE WITH CACHING
  async function loadSubmissions(forceRefresh = false) {
    // Check if we can use cached data
    const now = Date.now();
    const cacheValid =
      submissionsCache.data &&
      submissionsCache.timestamp &&
      submissionsCache.userId === currentUserId &&
      now - submissionsCache.timestamp < CACHE_DURATION;

    if (!forceRefresh && cacheValid) {
      console.log("Using cached submissions data");
      submissions = submissionsCache.data;
      return;
    }

    // Check if user changed
    const userChanged = lastUserId !== currentUserId;
    if (userChanged) {
      console.log("User changed, clearing cache");
      submissionsCache = { data: null, timestamp: null, userId: null };
    }

    loading = true;
    try {
      const formsRef = collection(db, "forms");

      // OPTIMIZATION: If not admin, use query to filter by userId on server side
      let snap;
      if (!isAdmin && currentUserId) {
        const q = query(formsRef, where("userId", "==", currentUserId));
        snap = await getDocs(q);
      } else {
        snap = await getDocs(formsRef);
      }

      let allSubmissions = snap.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          userId: data.userId || null,
          createdAt: data.createdAt || null,
          ...data,
        };
      });

      // For admin, filter might still be needed if some docs don't have userId
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

      // Update cache
      submissionsCache = {
        data: allSubmissions,
        timestamp: now,
        userId: currentUserId,
      };

      lastUserId = currentUserId;

      console.log(`Loaded ${allSubmissions.length} submissions from Firestore`);
    } catch (error) {
      console.error("Error loading submissions:", error);
      alert("Error loading submissions: " + error.message);
    } finally {
      loading = false;
    }
  }

  // CALCULATE LEAVE DAYS
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
  function calculateTotalHours() {
    if (overtimeForm.startTime && overtimeForm.endTime) {
      const start = overtimeForm.startTime.split(":");
      const end = overtimeForm.endTime.split(":");

      const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
      const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);

      let diffMinutes = endMinutes - startMinutes;

      if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
      }

      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;

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
        userName: $authStore.userData?.name || "",
        userNik: $authStore.userData?.nik || "",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      alert("Leave request submitted successfully");
      resetLeaveForm();

      // Invalidate cache and reload
      submissionsCache = { data: null, timestamp: null, userId: null };
      loadSubmissions(true);
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
        userName: $authStore.userData?.name || "",
        userNik: $authStore.userData?.nik || "",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      alert("Overtime request submitted successfully");
      resetOvertimeForm();

      // Invalidate cache and reload
      submissionsCache = { data: null, timestamp: null, userId: null };
      loadSubmissions(true);
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
        userName: $authStore.userData?.name || "",
        userNik: $authStore.userData?.nik || "",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      alert("Permission request submitted successfully");
      resetPermissionForm();

      // Invalidate cache and reload
      submissionsCache = { data: null, timestamp: null, userId: null };
      loadSubmissions(true);
    } catch (error) {
      console.error("Error submitting permission request:", error);
      alert("Failed to submit permission request");
    } finally {
      loading = false;
    }
  }

  // UPDATE SUBMISSION STATUS
  async function updateStatus(formId, newStatus, comment = "") {
    loading = true;
    try {
      const updateData = {
        updatedAt: Timestamp.now(),
      };

      // Admin approval
      if (newStatus === "approved" && $authStore.userData?.role === "admin") {
        updateData.status = "approved_by_admin";
        updateData.approvedByAdmin = $authStore.userData?.name || "";
        updateData.approvedByAdminAt = Timestamp.now();
        updateData.adminComment = comment;
        alert("Form approved by admin. Waiting for direktur approval.");
      }
      // Direktur approval
      else if (
        newStatus === "approved" &&
        $authStore.userData?.role === "direktur"
      ) {
        updateData.status = "approved";
        updateData.approvedByDirektur = $authStore.userData?.name || "";
        updateData.approvedByDirekturAt = Timestamp.now();
        updateData.direkturComment = comment;
        alert("Form fully approved by direktur.");
      }
      // Rejection at any stage
      else if (newStatus === "rejected") {
        updateData.status = "rejected";
        updateData.rejectedBy = $authStore.userData?.name || "";
        updateData.rejectedAt = Timestamp.now();
        updateData.rejectionComment = comment;
        alert("Form rejected.");
      }

      await updateDoc(doc(db, "forms", formId), updateData);

      // Invalidate cache and reload
      submissionsCache = { data: null, timestamp: null, userId: null };
      loadSubmissions(true);
    } catch (error) {
      console.error("Error updating form status:", error);
      alert("Failed to update form status");
    } finally {
      loading = false;
    }
  }

  // GENERATE BARCODE (Code128)
  function generateBarcode(text) {
    // Simple barcode generation using Code128B encoding
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");

    // White background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw barcode bars (simplified representation)
    ctx.fillStyle = "#000000";
    let x = 10;
    const barWidth = 2;
    const barHeight = 50;

    // Create pattern from text
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const pattern = charCode % 2 === 0 ? [1, 0, 1, 0] : [1, 1, 0, 0];

      for (let j = 0; j < pattern.length; j++) {
        if (pattern[j] === 1) {
          ctx.fillRect(x, 10, barWidth, barHeight);
        }
        x += barWidth;
      }
    }

    // Add text below barcode
    ctx.fillStyle = "#000000";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text.substring(0, 20), canvas.width / 2, 70);

    return canvas.toDataURL();
  }

  // Calculate overtime money
  function calculateOvertimeMoney(totalHours, date) {
    const baseRate = 21000; // Rp 21,000 per hour
    const dayOfWeek = new Date(date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6

    const multiplier = isWeekend ? 1.5 : 1;
    return Math.round(totalHours * baseRate * multiplier);
  }

  // Format currency to Indonesian Rupiah
  function formatCurrency(amount) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  }

  // Open comment modal
  function openCommentModal(formId, action) {
    commentModal = {
      show: true,
      formId: formId,
      action: action,
      comment: "",
    };
  }

  // Close comment modal
  function closeCommentModal() {
    commentModal = {
      show: false,
      formId: null,
      action: null,
      comment: "",
    };
  }

  // Submit with comment
  async function submitWithComment() {
    if (commentModal.action === "approve") {
      await updateStatus(commentModal.formId, "approved", commentModal.comment);
    } else if (commentModal.action === "reject") {
      await updateStatus(commentModal.formId, "rejected", commentModal.comment);
    }
    closeCommentModal();
  }

  // Helper function to escape CSV values
  function escapeCSVValue(value) {
    if (value === null || value === undefined) return "";
    const stringValue = String(value);
    // If value contains comma, newline, or quote, wrap in quotes and escape quotes
    if (
      stringValue.includes(",") ||
      stringValue.includes("\n") ||
      stringValue.includes('"')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  // CSV Export states
  let showCSVExportModal = false;
  let csvStartDate = "";
  let csvEndDate = "";
  let csvFormType = "all";

  // Open CSV Export Modal
  function openCSVExportModal() {
    // Set default date range (21st of last month to 20th of current month)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const startDate = new Date(currentYear, currentMonth - 1, 21);
    csvStartDate = startDate.toISOString().split("T")[0];

    const endDate = new Date(currentYear, currentMonth, 20);
    csvEndDate = endDate.toISOString().split("T")[0];

    csvFormType = "all";
    showCSVExportModal = true;
  }

  // Close CSV Export Modal
  function closeCSVExportModal() {
    showCSVExportModal = false;
  }

  // EXPORT TO CSV
  function exportToCSV() {
    if (!csvStartDate || !csvEndDate) {
      alert(
        $language === "id"
          ? "Silakan pilih tanggal mulai dan selesai"
          : "Please select start and end dates"
      );
      return;
    }

    // Validate date range
    if (new Date(csvStartDate) > new Date(csvEndDate)) {
      alert(
        $language === "id"
          ? "Tanggal mulai harus lebih awal dari tanggal selesai"
          : "Start date must be before end date"
      );
      return;
    }

    const startDate = new Date(csvStartDate);
    const endDate = new Date(csvEndDate);
    endDate.setHours(23, 59, 59, 999);

    const isIndonesian = $language === "id";

    // Filter submissions for the selected date range and form type
    const periodSubmissions = submissions.filter((sub) => {
      if (!sub.createdAt || !sub.createdAt.seconds) return false;

      const subDate = new Date(sub.createdAt.seconds * 1000);
      const matchesDate = subDate >= startDate && subDate <= endDate;
      const matchesType = csvFormType === "all" || sub.formType === csvFormType;

      return matchesDate && matchesType;
    });

    if (periodSubmissions.length === 0) {
      alert(
        isIndonesian
          ? "Tidak ada pengajuan pada periode yang dipilih"
          : "No submissions found for the selected period"
      );
      return;
    }

    // Prepare CSV headers
    const headers = [
      isIndonesian ? "No" : "No",
      isIndonesian ? "Nama Karyawan" : "Employee Name",
      "NIK",
      isIndonesian ? "Jenis Formulir" : "Form Type",
      isIndonesian ? "Sub Tipe" : "Sub Type",
      isIndonesian ? "Tanggal Mulai" : "Start Date",
      isIndonesian ? "Tanggal Selesai" : "End Date",
      isIndonesian ? "Total Hari" : "Total Days",
      isIndonesian ? "Jam Mulai" : "Start Time",
      isIndonesian ? "Jam Selesai" : "End Time",
      isIndonesian ? "Total Jam" : "Total Hours",
      isIndonesian ? "Uang Lembur" : "Overtime Pay",
      isIndonesian ? "Keperluan/Deskripsi" : "Reason/Description",
      "Status",
      isIndonesian ? "Disetujui Admin" : "Approved By Admin",
      isIndonesian ? "Disetujui Direktur" : "Approved By Direktur",
      isIndonesian ? "Komentar Admin" : "Admin Comment",
      isIndonesian ? "Komentar Direktur" : "Direktur Comment",
      isIndonesian ? "Komentar Penolakan" : "Rejection Comment",
      isIndonesian ? "Tanggal Pengajuan" : "Submission Date",
    ];

    // Prepare CSV rows
    const rows = periodSubmissions.map((sub, index) => {
      const formTypeLabel =
        sub.formType === "leave"
          ? isIndonesian
            ? "Cuti"
            : "Leave"
          : sub.formType === "overtime"
            ? isIndonesian
              ? "Lembur"
              : "Overtime"
            : isIndonesian
              ? "Izin"
              : "Permission";

      const subType = sub.leaveType || sub.permissionType || "-";

      const statusText =
        sub.status === "approved"
          ? isIndonesian
            ? "Disetujui"
            : "Approved"
          : sub.status === "rejected"
            ? isIndonesian
              ? "Ditolak"
              : "Rejected"
            : sub.status === "approved_by_admin"
              ? isIndonesian
                ? "Menunggu Direktur"
                : "Waiting Direktur"
              : isIndonesian
                ? "Tertunda"
                : "Pending";

      const overtimeMoney =
        sub.formType === "overtime" && sub.totalHours
          ? calculateOvertimeMoney(sub.totalHours, sub.date)
          : 0;

      return [
        index + 1,
        sub.userName || "-",
        sub.userNik || "-",
        formTypeLabel,
        subType,
        sub.startDate || "-",
        sub.endDate || "-",
        sub.totalDays || "-",
        sub.startTime || "-",
        sub.endTime || "-",
        sub.totalHours || "-",
        overtimeMoney > 0 ? overtimeMoney : "-",
        (sub.reason || sub.workDescription || sub.details || "-").replace(
          /[\n\r]/g,
          " "
        ),
        statusText,
        sub.approvedByAdmin || "-",
        sub.approvedByDirektur || "-",
        (sub.adminComment || "-").replace(/[\n\r]/g, " "),
        (sub.direkturComment || "-").replace(/[\n\r]/g, " "),
        (sub.rejectionComment || "-").replace(/[\n\r]/g, " "),
        formatDate(sub.createdAt),
      ];
    });

    // Convert to CSV format
    const csvContent = [
      headers.map(escapeCSVValue).join(","),
      ...rows.map((row) => row.map(escapeCSVValue).join(",")),
    ].join("\n");

    // Add BOM for proper Excel UTF-8 encoding
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    // Create download link
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    const formTypeLabel =
      csvFormType === "all"
        ? isIndonesian
          ? "Semua"
          : "All"
        : csvFormType === "leave"
          ? isIndonesian
            ? "Cuti"
            : "Leave"
          : csvFormType === "overtime"
            ? isIndonesian
              ? "Lembur"
              : "Overtime"
            : isIndonesian
              ? "Izin"
              : "Permission";

    const filename = `Laporan_${formTypeLabel}_${csvStartDate}_${csvEndDate}.csv`;
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showCSVExportModal = false;
  }

  // PRINT INDIVIDUAL PDF
  function printIndividualPDF(submission) {
    const printWindow = window.open("", "", "width=800,height=600");

    const formTypeLabel =
      submission.formType === "leave"
        ? "Leave Request"
        : submission.formType === "overtime"
          ? "Overtime Request"
          : "Permission Request";

    // Generate barcodes for approvals
    const adminBarcode = generateBarcode(
      `ADMIN-${submission.id.substring(0, 8)}`
    );
    const direkturBarcode = generateBarcode(
      `DIR-${submission.id.substring(0, 8)}`
    );

    // Calculate overtime money if applicable
    const overtimeMoney =
      submission.formType === "overtime" && submission.totalHours
        ? calculateOvertimeMoney(submission.totalHours, submission.date)
        : 0;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${formTypeLabel} - ${submission.userName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          background: white;
        }
        .logo-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e5e7eb;
        }
        .logo-header img {
          height: 60px;
          width: auto;
        }
        .logo-header .company-info h1 {
          color: #1A4786;
          font-size: 20px;
          margin-bottom: 3px;
        }
        .logo-header .company-info p {
          color: #666;
          font-size: 12px;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #1A4786;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #1A4786;
          font-size: 24px;
          margin-bottom: 5px;
        }
        .header p {
          color: #666;
          font-size: 14px;
        }
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 12px;
          margin: 10px 0;
          background: #22c55e;
          color: white;
        }
        .info-section {
          margin: 20px 0;
        }
        .info-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-label {
          font-weight: bold;
          color: #1A4786;
          width: 180px;
          flex-shrink: 0;
        }
        .info-value {
          color: #333;
          flex: 1;
        }
        .money-highlight {
          color: #00A63E;
          font-weight: bold;
          font-size: 18px;
          background: #E1F5E4;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .comment-box {
          background: #f0f9ff;
          border-left: 4px solid #3b82f6;
          padding: 12px;
          margin: 10px 0;
          border-radius: 4px;
        }
        .comment-box.rejection {
          background: #fef2f2;
          border-left-color: #ef4444;
        }
        .comment-box h4 {
          color: #1A4786;
          font-size: 12px;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .comment-box p {
          color: #333;
          font-size: 13px;
          line-height: 1.5;
        }
        .approval-section {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #1A4786;
        }
        .approval-row {
          display: flex;
          justify-content: space-between;
          margin: 30px 0;
        }
        .approval-box {
          text-align: center;
          width: 45%;
          border: 2px solid #e5e7eb;
          padding: 20px;
          border-radius: 10px;
          background: #f9fafb;
        }
        .approval-box h3 {
          color: #1A4786;
          font-size: 14px;
          margin-bottom: 15px;
        }
        .barcode-container {
          margin: 20px 0;
          padding: 10px;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 5px;
        }
        .barcode-container img {
          max-width: 100%;
          height: auto;
        }
        .approval-info {
          margin-top: 10px;
          font-size: 11px;
          color: #666;
        }
        .verified-badge {
          display: inline-block;
          background: #22c55e;
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: bold;
          margin-top: 10px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #e5e7eb;
          padding-top: 20px;
        }
        @media print {
          body { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="logo-header">
        <img src="${companyLogo}" alt="Company Logo" />
        <div class="company-info">
          <h1>Fineer by TripleS</h1>
          <p>Employee Management System</p>
        </div>
      </div>
      
      <div class="header">
        <h1>${formTypeLabel}</h1>
        <p>Document ID: ${submission.id}</p>
        <span class="status-badge">✓ APPROVED & VERIFIED</span>
      </div>
      
      <div class="info-section">
        <div class="info-row">
          <div class="info-label">Employee Name:</div>
          <div class="info-value">${submission.userName}</div>
        </div>
        <div class="info-row">
          <div class="info-label">NIK:</div>
          <div class="info-value">${submission.userNik}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Submission Date:</div>
          <div class="info-value">${formatDate(submission.createdAt)}</div>
        </div>
        ${
          submission.formType === "leave"
            ? `
        <div class="info-row">
          <div class="info-label">Leave Type:</div>
          <div class="info-value">${submission.leaveType}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Start Date:</div>
          <div class="info-value">${submission.startDate}</div>
        </div>
        <div class="info-row">
          <div class="info-label">End Date:</div>
          <div class="info-value">${submission.endDate}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Total Days:</div>
          <div class="info-value">${submission.totalDays} days</div>
        </div>
        <div class="info-row">
          <div class="info-label">Reason:</div>
          <div class="info-value">${submission.reason}</div>
        </div>
        `
            : submission.formType === "overtime"
              ? `
        <div class="info-row">
          <div class="info-label">Date:</div>
          <div class="info-value">${submission.date}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Start Time:</div>
          <div class="info-value">${submission.startTime}</div>
        </div>
        <div class="info-row">
          <div class="info-label">End Time:</div>
          <div class="info-value">${submission.endTime}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Total Hours:</div>
          <div class="info-value">${submission.totalHours} hours</div>
        </div>
        <div class="info-row">
          <div class="info-label">Overtime Pay:</div>
          <div class="info-value">
            <span class="money-highlight">${formatCurrency(overtimeMoney)}</span>
            <br>
            <small style="color: #666; font-size: 11px;">
              ${submission.totalHours} jam × Rp 21.000${
                new Date(submission.date).getDay() === 0 ||
                new Date(submission.date).getDay() === 6
                  ? " × 1.5 (weekend)"
                  : ""
              }
            </small>
          </div>
        </div>
        <div class="info-row">
          <div class="info-label">Work Description:</div>
          <div class="info-value">${submission.workDescription}</div>
        </div>
        `
              : `
        <div class="info-row">
          <div class="info-label">Permission Type:</div>
          <div class="info-value">${submission.permissionType}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Date:</div>
          <div class="info-value">${submission.date}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Details:</div>
          <div class="info-value">${submission.details}</div>
        </div>
        `
        }
      </div>
      
      ${
        submission.adminComment
          ? `
      <div class="comment-box">
        <h4>Admin Note</h4>
        <p>${submission.adminComment}</p>
      </div>
      `
          : ""
      }
      
      ${
        submission.direkturComment
          ? `
      <div class="comment-box">
        <h4>Direktur Note</h4>
        <p>${submission.direkturComment}</p>
      </div>
      `
          : ""
      }
      
      ${
        submission.rejectionComment
          ? `
      <div class="comment-box rejection">
        <h4>Rejection Note</h4>
        <p>${submission.rejectionComment}</p>
      </div>
      `
          : ""
      }
      
      <div class="approval-section">
        <h2 style="color: #1A4786; margin-bottom: 20px;">Digital Approval Verification</h2>
        <div class="approval-row">
          <div class="approval-box">
            <h3>Admin Approval</h3>
            <p><strong>${submission.approvedByAdmin || "-"}</strong></p>
            <p class="approval-info">${submission.approvedByAdminAt ? formatDate(submission.approvedByAdminAt) : ""}</p>
            <div class="barcode-container">
              <img src="${adminBarcode}" alt="Admin Approval Barcode" />
            </div>
            <span class="verified-badge">✓ VERIFIED</span>
          </div>
          <div class="approval-box">
            <h3>Direktur Approval</h3>
            <p><strong>${submission.approvedByDirektur || "-"}</strong></p>
            <p class="approval-info">${submission.approvedByDirekturAt ? formatDate(submission.approvedByDirekturAt) : ""}</p>
            <div class="barcode-container">
              <img src="${direkturBarcode}" alt="Direktur Approval Barcode" />
            </div>
            <span class="verified-badge">✓ VERIFIED</span>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <p><strong>This is a digitally verified document with barcode authentication.</strong></p>
        <p>Document generated on: ${new Date().toLocaleString()}</p>
        <p style="margin-top: 5px; font-size: 10px;">Verification codes are unique to this approval process.</p>
      </div>
    </body>
    </html>
  `;

    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = function () {
      printWindow.print();
    };
  }

  // PRINT MONTHLY REPORT
  async function printMonthlyReport() {
    if (!reportStartDate || !reportEndDate) {
      alert(
        $language === "id"
          ? "Silakan pilih tanggal mulai dan selesai"
          : "Please select start and end dates"
      );
      return;
    }

    // Validate date range
    if (new Date(reportStartDate) > new Date(reportEndDate)) {
      alert(
        $language === "id"
          ? "Tanggal mulai harus lebih awal dari tanggal selesai"
          : "Start date must be before end date"
      );
      return;
    }

    loading = true;

    try {
      // Get current language before filtering
      const currentLang = $language;
      const isIndonesian = currentLang === "id";

      const startDate = new Date(reportStartDate);
      const endDate = new Date(reportEndDate);
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);

      // Filter submissions for the selected date range and form type
      const periodSubmissions = submissions.filter((sub) => {
        if (!sub.createdAt || !sub.createdAt.seconds) return false;

        const subDate = new Date(sub.createdAt.seconds * 1000);

        const matchesDate = subDate >= startDate && subDate <= endDate;
        const matchesType =
          reportFormType === "all" || sub.formType === reportFormType;

        return matchesDate && matchesType;
      });

      if (periodSubmissions.length === 0) {
        alert(
          isIndonesian
            ? "Tidak ada pengajuan pada periode yang dipilih"
            : "No submissions found for the selected period"
        );
        loading = false;
        return;
      }

      const printWindow = window.open("", "", "width=1000,height=800");

      // Format date range for display
      const formatDateDisplay = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(isIndonesian ? "id-ID" : "en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      };

      const dateRangeDisplay = `${formatDateDisplay(reportStartDate)} - ${formatDateDisplay(reportEndDate)}`;

      // Get form type label
      const formTypeLabel =
        reportFormType === "all"
          ? isIndonesian
            ? "Semua Formulir"
            : "All Forms"
          : reportFormType === "leave"
            ? isIndonesian
              ? "Cuti"
              : "Leave"
            : reportFormType === "overtime"
              ? isIndonesian
                ? "Lembur"
                : "Overtime"
              : isIndonesian
                ? "Izin"
                : "Permission";

      // Calculate total overtime money if overtime report
      let totalOvertimeMoney = 0;
      if (reportFormType === "overtime" || reportFormType === "all") {
        periodSubmissions.forEach((sub) => {
          if (
            sub.formType === "overtime" &&
            sub.totalHours &&
            sub.status === "approved"
          ) {
            totalOvertimeMoney += calculateOvertimeMoney(
              sub.totalHours,
              sub.date
            );
          }
        });
      }

      // Check if we need overtime pay column
      const showOvertimeColumn =
        reportFormType === "all" || reportFormType === "overtime";

      const tableRows = periodSubmissions
        .map((sub, index) => {
          // Get details based on form type
          let details = "";
          let dateInfo = "";
          let overtimePayCell = "";

          if (sub.formType === "leave") {
            dateInfo = `${sub.startDate} ${isIndonesian ? "sampai" : "to"} ${sub.endDate} (${sub.totalDays} ${isIndonesian ? "hari" : "days"})`;
            details = sub.reason || "-";
            overtimePayCell = showOvertimeColumn
              ? '<td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #999;">-</td>'
              : "";
          } else if (sub.formType === "overtime") {
            dateInfo = `${sub.date} (${sub.startTime} - ${sub.endTime})`;
            details = sub.workDescription || "-";
            const overtimeMoney = calculateOvertimeMoney(
              sub.totalHours,
              sub.date
            );
            overtimePayCell = showOvertimeColumn
              ? `
            <td style="border: 1px solid #ddd; padding: 8px; vertical-align: top; text-align: right;">
              <strong style="color: #16a34a; font-size: 12px;">${formatCurrency(overtimeMoney)}</strong>
              <br/>
              <span style="font-size: 9px; color: #666;">
                ${sub.totalHours} jam × Rp 20k${new Date(sub.date).getDay() === 0 || new Date(sub.date).getDay() === 6 ? " × 1.5" : ""}
              </span>
            </td>
          `
              : "";
          } else if (sub.formType === "permission") {
            dateInfo = sub.date || "-";
            details = sub.details || "-";
            overtimePayCell = showOvertimeColumn
              ? '<td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #999;">-</td>'
              : "";
          }

          const formTypeBadge =
            sub.formType === "leave"
              ? isIndonesian
                ? "Cuti"
                : "Leave"
              : sub.formType === "overtime"
                ? isIndonesian
                  ? "Lembur"
                  : "Overtime"
                : isIndonesian
                  ? "Izin"
                  : "Permission";

          const statusText =
            sub.status === "approved"
              ? `✓ ${isIndonesian ? "Disetujui" : "Approved"}`
              : sub.status === "rejected"
                ? `✗ ${isIndonesian ? "Ditolak" : "Rejected"}`
                : sub.status === "approved_by_admin"
                  ? `⏱ ${isIndonesian ? "Menunggu Direktur" : "Waiting Direktur"}`
                  : `⏱ ${isIndonesian ? "Tertunda" : "Pending"}`;

          return `
      <tr style="page-break-inside: avoid;">
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; vertical-align: top;">${index + 1}</td>
        <td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">
          <strong>${sub.userName}</strong><br/>
          <span style="font-size: 10px; color: #666;">NIK: ${sub.userNik}</span>
        </td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; vertical-align: top;">
          <span style="padding: 3px 8px; border-radius: 8px; font-size: 10px; font-weight: bold; background: #e0e7ff; color: #3730a3; display: inline-block;">
            ${formTypeBadge}
          </span>
          ${sub.formType === "leave" && sub.leaveType ? `<br/><span style="font-size: 9px; color: #666;">${sub.leaveType}</span>` : ""}
          ${sub.formType === "permission" && sub.permissionType ? `<br/><span style="font-size: 9px; color: #666;">${sub.permissionType}</span>` : ""}
        </td>
        <td style="border: 1px solid #ddd; padding: 8px; font-size: 11px; vertical-align: top;">
          ${dateInfo}
        </td>
        <td style="border: 1px solid #ddd; padding: 8px; font-size: 11px; vertical-align: top; max-width: 200px;">
          ${details}
        </td>
        ${overtimePayCell}
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; vertical-align: top;">
          <span style="padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; display: inline-block;
            ${
              sub.status === "approved"
                ? "background: #22c55e; color: white;"
                : sub.status === "rejected"
                  ? "background: #ef4444; color: white;"
                  : sub.status === "approved_by_admin"
                    ? "background: #3b82f6; color: white;"
                    : "background: #f59e0b; color: white;"
            }">
            ${statusText}
          </span><br/>
          <span style="font-size: 9px; color: #666; margin-top: 3px; display: inline-block;">
            ${formatDate(sub.createdAt)}
          </span>
        </td>
      </tr>
    `;
        })
        .join("");

      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${$language === "id" ? "Laporan Periode" : "Period Report"} - ${formTypeLabel}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            padding: 30px;
            background: white;
          }
          .logo-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #1A4786;
          }
          .logo-section {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .logo-section img {
            height: 50px;
            width: auto;
          }
          .logo-section .company-info h1 {
            color: #1A4786;
            font-size: 18px;
            margin-bottom: 3px;
          }
          .logo-section .company-info p {
            color: #666;
            font-size: 11px;
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #1A4786;
            font-size: 28px;
            margin-bottom: 5px;
          }
          .header p {
            color: #666;
            font-size: 14px;
            margin-bottom: 8px;
          }
          .header .form-type-badge {
            display: inline-block;
            padding: 6px 16px;
            background: linear-gradient(135deg, #1A4786, #3A7AE0);
            color: white;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 8px;
          }
          .summary {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
          }
          .summary-item {
            text-align: center;
          }
          .summary-item h3 {
            color: #1A4786;
            font-size: 32px;
            margin-bottom: 5px;
          }
          .summary-item p {
            color: #666;
            font-size: 14px;
          }
          .money-summary {
            background: linear-gradient(135deg, #16a34a, #22c55e);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            margin: 20px 0;
          }
          .money-summary h3 {
            font-size: 14px;
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          .money-summary .amount {
            font-size: 36px;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th {
            background: #1A4786;
            color: white;
            padding: 12px 8px;
            text-align: left;
            font-size: 11px;
          }
          td {
            border: 1px solid #ddd;
            padding: 8px;
            font-size: 11px;
            vertical-align: top;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          @media print {
            body { padding: 15px; }
            .summary { page-break-after: avoid; }
            .money-summary { page-break-after: avoid; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        <div class="logo-header">
          <div class="logo-section">
            <img src="${companyLogo}" alt="Company Logo" />
            <div class="company-info">
              <h1>Fineer by TripleS</h1>
              <p>${$language === "id" ? "Manajemen Sumber Daya Manusia" : "Human Resources Management"}</p>
            </div>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 11px; color: #666;">${$language === "id" ? "Laporan Dibuat" : "Report Generated"}</p>
            <p style="font-size: 11px; color: #1A4786; font-weight: bold;">${new Date().toLocaleDateString($language === "id" ? "id-ID" : "en-US")}</p>
          </div>
        </div>
        
        <div class="header">
          <h1>${$language === "id" ? "Laporan Periode" : "Period Report"}</h1>
          <p>${dateRangeDisplay}</p>
          <span class="form-type-badge">${formTypeLabel}</span>
        </div>
        
        ${
          totalOvertimeMoney > 0
            ? `
        <div class="money-summary">
          <h3>${$language === "id" ? "Total Uang Lembur Yang Disetujui" : "Total Approved Overtime Pay"}</h3>
          <div class="amount">${formatCurrency(totalOvertimeMoney)}</div>
        </div>
        `
            : ""
        }
        
        <div class="summary">
          <div class="summary-item">
            <h3>${periodSubmissions.length}</h3>
            <p>${$language === "id" ? "Total Pengajuan" : "Total Submissions"}</p>
          </div>
          <div class="summary-item">
            <h3>${periodSubmissions.filter((s) => s.status === "approved").length}</h3>
            <p>${$language === "id" ? "Disetujui" : "Approved"}</p>
          </div>
          <div class="summary-item">
            <h3>${periodSubmissions.filter((s) => s.status === "pending" || s.status === "approved_by_admin").length}</h3>
            <p>${$language === "id" ? "Tertunda" : "Pending"}</p>
          </div>
          <div class="summary-item">
            <h3>${periodSubmissions.filter((s) => s.status === "rejected").length}</h3>
            <p>${$language === "id" ? "Ditolak" : "Rejected"}</p>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 30px;">No</th>
              <th style="width: 110px;">${$language === "id" ? "Karyawan" : "Employee"}</th>
              <th style="width: 70px;">${$language === "id" ? "Jenis" : "Type"}</th>
              <th style="width: 130px;">${$language === "id" ? "Tanggal/Periode" : "Date/Period"}</th>
              <th style="width: ${showOvertimeColumn ? "180px" : "220px"};">${$language === "id" ? "Keperluan/Deskripsi" : "Reason/Description"}</th>
              ${showOvertimeColumn ? `<th style="text-align: center; width: 100px;">${$language === "id" ? "Uang Lembur" : "Overtime Pay"}</th>` : ""}
              <th style="text-align: center; width: 90px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        
        <div class="footer">
          <p>${$language === "id" ? "Laporan ini dibuat secara otomatis pada" : "This report was generated automatically on"} ${new Date().toLocaleString($language === "id" ? "id-ID" : "en-US")}</p>
          <p>${$language === "id" ? "Periode" : "Period"}: ${dateRangeDisplay}</p>
          <p>${$language === "id" ? "Total rekaman" : "Total records"}: ${periodSubmissions.length}</p>
          ${totalOvertimeMoney > 0 ? `<p style="margin-top: 5px;"><strong style="color: #16a34a;">${$language === "id" ? "Total Uang Lembur" : "Total Overtime Pay"}: ${formatCurrency(totalOvertimeMoney)}</strong></p>` : ""}
          <p style="margin-top: 10px; font-size: 10px;">Fineer by TripleS - ${$language === "id" ? "Dokumen Rahasia" : "Confidential Document"}</p>
        </div>
      </body>
      </html>
    `;

      printWindow.document.write(html);
      printWindow.document.close();

      printWindow.onload = function () {
        printWindow.print();
      };

      showMonthlyReportModal = false;
    } catch (error) {
      console.error("Error generating period report:", error);
      alert("Failed to generate period report");
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

  // FILTER SUBMISSIONS BASED ON ACTIVE FILTER AND ROLE
  $: filteredSubmissions = submissions.filter((submission) => {
    // Direktur should only see submissions approved by admin
    if (
      $authStore.userData?.role === "direktur" &&
      submission.status === "pending"
    ) {
      return false;
    }

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
      <script>
        import { translations } from "../i18n/translations";
        import { language } from "../../stores/language";
        import { fly } from "svelte/transition";
        import { quintOut } from "svelte/easing";

        let currentView = "";
        let activeForm = "";
      </script>

      <!-- Card Selection View -->
      <div class="max-w-7xl mx-auto" in:fade={{ duration: 300 }}>
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
              <!-- Icon stays the same -->
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
              {t.leaveRequest}
            </h3>
            <p class="text-gray-600 leading-relaxed">{t.leaveRequestDesc}</p>
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
              {t.overtimeRequest}
            </h3>
            <p class="text-gray-600 leading-relaxed">
              {t.overtimeRequestDesc}
            </p>
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
              {t.permissionRequest}
            </h3>
            <p class="text-gray-600 leading-relaxed">
              {t.permissionRequestDesc}
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
            aria-hidden="true"
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
      <div class="flex gap-2 flex-wrap">
        {#if isAdmin}
          <button
            on:click={() => (showMonthlyReportModal = true)}
            class="px-6 py-3 bg-linear-to-r from-[#FFD700] to-[#FFA500] hover:shadow-lg hover:scale-105 text-[#1A4786] rounded-xl font-semibold transition-all flex items-center gap-2"
            aria-label="Generate monthly report"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Monthly Report
          </button>
          <button
            on:click={openCSVExportModal}
            class="px-6 py-3 bg-linear-to-r from-green-600 to-green-500 hover:shadow-lg hover:scale-105 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
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
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {$language === "id" ? "Ekspor CSV" : "Export CSV"}
          </button>
        {/if}
        <!-- CSV Export Modal -->
        {#if showCSVExportModal}
          <div
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            on:click={() => (showCSVExportModal = false)}
            on:keydown={(e) =>
              e.key === "Escape" && (showCSVExportModal = false)}
            role="dialog"
            tabindex="-1"
            aria-modal="true"
            aria-labelledby="csv-modal-title"
          >
            <div
              class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
              on:click|stopPropagation
              on:keydown|stopPropagation
              role="presentation"
              in:fly={{ y: 20, duration: 300, easing: quintOut }}
            >
              <div class="flex justify-between items-center mb-6">
                <h3
                  id="csv-modal-title"
                  class="text-2xl font-bold text-[#1A4786]"
                >
                  {$language === "id" ? "Ekspor CSV" : "Export CSV"}
                </h3>
                <button
                  on:click={() => (showCSVExportModal = false)}
                  class="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close modal"
                >
                  <svg
                    class="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div class="space-y-4">
                <!-- Info Box -->
                <div
                  class="p-3 bg-green-50 border-l-4 border-green-500 rounded-lg"
                >
                  <p class="text-xs text-green-800">
                    {$language === "id"
                      ? "💡 Secara default: Tanggal 21 bulan lalu sampai tanggal 20 bulan ini"
                      : "💡 Default: 21st of last month to 20th of current month"}
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      for="csv-start-date"
                      class="block text-sm font-semibold text-[#1A4786] mb-2"
                    >
                      {$language === "id" ? "Tanggal Mulai" : "Start Date"}
                    </label>
                    <input
                      id="csv-start-date"
                      type="date"
                      bind:value={csvStartDate}
                      class="w-full px-3 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all text-[#1A4786] font-medium hover:border-gray-300"
                    />
                  </div>

                  <div>
                    <label
                      for="csv-end-date"
                      class="block text-sm font-semibold text-[#1A4786] mb-2"
                    >
                      {$language === "id" ? "Tanggal Selesai" : "End Date"}
                    </label>
                    <input
                      id="csv-end-date"
                      type="date"
                      bind:value={csvEndDate}
                      class="w-full px-3 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all text-[#1A4786] font-medium hover:border-gray-300"
                    />
                  </div>
                </div>

                <div>
                  <label
                    for="csv-form-type"
                    class="block text-sm font-semibold text-[#1A4786] mb-2"
                  >
                    {$language === "id" ? "Jenis Formulir" : "Form Type"}
                  </label>
                  <select
                    id="csv-form-type"
                    bind:value={csvFormType}
                    class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%236b7280%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-size-[1.5em_1.5em] bg-position-[right_0.5rem_center] bg-no-repeat pr-10"
                  >
                    <option value="all"
                      >{$language === "id"
                        ? "Semua Formulir"
                        : "All Forms"}</option
                    >
                    <option value="leave"
                      >{$language === "id" ? "Cuti Saja" : "Leave Only"}</option
                    >
                    <option value="overtime"
                      >{$language === "id"
                        ? "Lembur Saja"
                        : "Overtime Only"}</option
                    >
                    <option value="permission"
                      >{$language === "id"
                        ? "Izin Saja"
                        : "Permission Only"}</option
                    >
                  </select>
                </div>

                <!-- Quick preset buttons -->
                <div class="space-y-2">
                  <p
                    class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {$language === "id" ? "Preset Cepat" : "Quick Presets"}
                  </p>
                  <div class="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      on:click={() => {
                        const now = new Date();
                        const start = new Date(
                          now.getFullYear(),
                          now.getMonth() - 1,
                          21
                        );
                        const end = new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          20
                        );
                        csvStartDate = start.toISOString().split("T")[0];
                        csvEndDate = end.toISOString().split("T")[0];
                      }}
                      class="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-all"
                    >
                      {$language === "id" ? "Bulan Ini" : "This Period"}
                    </button>
                    <button
                      type="button"
                      on:click={() => {
                        const now = new Date();
                        const start = new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          1
                        );
                        const end = new Date(
                          now.getFullYear(),
                          now.getMonth() + 1,
                          0
                        );
                        csvStartDate = start.toISOString().split("T")[0];
                        csvEndDate = end.toISOString().split("T")[0];
                      }}
                      class="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-all"
                    >
                      {$language === "id" ? "Bulan Kalender" : "Calendar Month"}
                    </button>
                    <button
                      type="button"
                      on:click={() => {
                        const now = new Date();
                        const start = new Date(
                          now.getFullYear(),
                          now.getMonth() - 2,
                          21
                        );
                        const end = new Date(
                          now.getFullYear(),
                          now.getMonth() - 1,
                          20
                        );
                        csvStartDate = start.toISOString().split("T")[0];
                        csvEndDate = end.toISOString().split("T")[0];
                      }}
                      class="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-all"
                    >
                      {$language === "id" ? "Periode Lalu" : "Last Period"}
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex gap-3 mt-6">
                <button
                  on:click={() => (showCSVExportModal = false)}
                  class="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
                  aria-label="Cancel CSV export"
                >
                  {$language === "id" ? "Batal" : "Cancel"}
                </button>
                <button
                  on:click={exportToCSV}
                  disabled={loading || !csvStartDate || !csvEndDate}
                  class="flex-1 px-6 py-3 bg-linear-to-r from-green-600 to-green-500 hover:shadow-lg hover:scale-105 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Export CSV file"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {$language === "id" ? "Ekspor CSV" : "Export CSV"}
                </button>
              </div>
            </div>
          </div>
        {/if}
        <button
          on:click={handleRefreshClick}
          class="px-6 py-3 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] hover:shadow-lg hover:scale-105 text-white rounded-xl font-semibold transition-all flex items-center gap-2"
          aria-label="Refresh submissions list"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
          aria-label="Show all submissions"
          aria-pressed={activeFilter === "all"}
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
          aria-label="Show pending submissions"
          aria-pressed={activeFilter === "pending"}
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
          aria-label="Show approved submissions"
          aria-pressed={activeFilter === "approved"}
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
          aria-label="Show rejected submissions"
          aria-pressed={activeFilter === "rejected"}
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
            role="status"
            aria-label="Loading submissions"
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
              aria-hidden="true"
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
            <article
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
                      role="status"
                    >
                      {submission.formType === "leave"
                        ? t.leaveRequest
                        : submission.formType === "overtime"
                          ? t.overtimeRequest
                          : t.permissionRequest}
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
                      role="status"
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
                        aria-hidden="true"
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
                        aria-hidden="true"
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
                  <!-- Sumbission Detail Box -->
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
                          {submission.formType === "leave"
                            ? `${submission.startDate} - ${submission.endDate}`
                            : submission.date}
                        </p>
                      </div>
                      {#if submission.formType === "overtime"}
                        <div>
                          <span
                            class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                            >{t.duration}</span
                          >
                          <p class="text-sm font-bold text-[#1A4786] mt-1">
                            {submission.totalHours}
                            {t.hours}
                          </p>
                        </div>
                      {:else if submission.formType === "leave"}
                        <div>
                          <span
                            class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                            >Total Days</span
                          >
                          <p class="text-sm font-bold text-[#1A4786] mt-1">
                            {submission.totalDays} days
                          </p>
                        </div>
                      {/if}
                    </div>

                    {#if submission.formType === "overtime"}
                      <div>
                        <span
                          class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                          >{t.workDescription}</span
                        >
                        <p class="text-sm text-gray-700 mt-1">
                          {submission.workDescription}
                        </p>
                      </div>
                    {:else if submission.formType === "leave"}
                      <div>
                        <span
                          class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                          >{t.type}</span
                        >
                        <p class="text-sm text-gray-700 mt-1">
                          {submission.leaveType}
                        </p>
                      </div>
                      <div>
                        <span
                          class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                          >{t.reason}</span
                        >
                        <p class="text-sm text-gray-700 mt-1">
                          {submission.reason}
                        </p>
                      </div>
                    {:else if submission.formType === "permission"}
                      <div>
                        <span
                          class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                          >Permission Type</span
                        >
                        <p class="text-sm text-gray-700 mt-1">
                          {submission.permissionType}
                        </p>
                      </div>
                      <div>
                        <span
                          class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                          >Details</span
                        >
                        <p class="text-sm text-gray-700 mt-1">
                          {submission.details}
                        </p>
                      </div>
                    {/if}

                    {#if submission.formType === "overtime" && submission.totalHours}
                      <div class="pt-3 border-t border-gray-200">
                        <div class="flex justify-between items-center">
                          <span
                            class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                          >
                            {$language === "id"
                              ? "Perhitungan Uang Lembur"
                              : "Overtime Pay"}
                          </span>
                          <span class="text-lg font-bold text-green-600">
                            {formatCurrency(
                              calculateOvertimeMoney(
                                submission.totalHours,
                                submission.date
                              )
                            )}
                          </span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">
                          {submission.totalHours} jam × Rp 21.000
                          {new Date(submission.date).getDay() === 0 ||
                          new Date(submission.date).getDay() === 6
                            ? " × 1.5 (weekend)"
                            : ""}
                        </p>
                      </div>
                    {/if}

                    {#if submission.adminComment}
                      <div class="pt-3 border-t border-gray-200">
                        <p
                          class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1"
                        >
                          Admin Note
                        </p>
                        <p class="text-sm text-gray-700 bg-blue-50 p-2 rounded">
                          {submission.adminComment}
                        </p>
                      </div>
                    {/if}

                    {#if submission.direkturComment}
                      <div class="pt-3 border-t border-gray-200">
                        <p
                          class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1"
                        >
                          Direktur Note
                        </p>
                        <p
                          class="text-sm text-gray-700 bg-green-50 p-2 rounded"
                        >
                          {submission.direkturComment}
                        </p>
                      </div>
                    {/if}

                    {#if submission.rejectionComment}
                      <div class="pt-3 border-t border-gray-200">
                        <p
                          class="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1"
                        >
                          Rejection Note
                        </p>
                        <p class="text-sm text-red-700 bg-red-50 p-2 rounded">
                          {submission.rejectionComment}
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

                <div class="flex lg:flex-col gap-2">
                  {#if $authStore.userData?.role === "admin" && submission.status === "pending"}
                    <!-- Admin can approve pending submissions -->
                    <button
                      on:click={() =>
                        openCommentModal(submission.id, "approve")}
                      disabled={loading}
                      class="flex-1 lg:flex-none px-6 py-3 bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
                      on:click={() => openCommentModal(submission.id, "reject")}
                      disabled={loading}
                      class="flex-1 lg:flex-none px-6 py-3 bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
                  {/if}

                  {#if $authStore.userData?.role === "direktur" && submission.status === "approved_by_admin"}
                    <!-- Direktur can approve submissions approved by admin -->
                    <button
                      on:click={() =>
                        openCommentModal(submission.id, "approve")}
                      disabled={loading}
                      class="flex-1 lg:flex-none px-6 py-3 bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
                      on:click={() => openCommentModal(submission.id, "reject")}
                      disabled={loading}
                      class="flex-1 lg:flex-none px-6 py-3 bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
                  {/if}

                  {#if submission.status === "approved" && submission.approvedByAdmin && submission.approvedByDirektur}
                    <!-- Print button for fully approved submissions -->
                    <button
                      on:click={() => printIndividualPDF(submission)}
                      class="flex-1 lg:flex-none px-6 py-3 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] hover:shadow-lg hover:scale-105 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                      aria-label="Print approved submission as PDF"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                        />
                      </svg>
                      Print PDF
                    </button>
                  {/if}
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Monthly Report Modal -->
  {#if showMonthlyReportModal}
    <div
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      on:click={() => (showMonthlyReportModal = false)}
      on:keydown={(e) => e.key === "Escape" && (showMonthlyReportModal = false)}
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
        on:click|stopPropagation
        on:keydown|stopPropagation
        role="presentation"
        in:fly={{ y: 20, duration: 300, easing: quintOut }}
      >
        <div class="flex justify-between items-center mb-6">
          <h3 id="modal-title" class="text-2xl font-bold text-[#1A4786]">
            {$language === "id"
              ? "Buat Laporan Periode"
              : "Generate Period Report"}
          </h3>
          <button
            on:click={() => (showMonthlyReportModal = false)}
            class="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          <!-- Info Box -->
          <div class="p-3 bg-blue-50 border-l-4 border-[#3A7AE0] rounded-lg">
            <p class="text-xs text-[#1A4786]">
              {$language === "id"
                ? "💡 Secara default: Tanggal 21 bulan lalu sampai tanggal 20 bulan ini"
                : "💡 Default: 21st of last month to 20th of current month"}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
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
                class="w-full px-3 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:ring-2 focus:ring-[#3A7AE0]/20 transition-all text-[#1A4786] font-medium hover:border-gray-300"
              />
            </div>

            <div>
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
                class="w-full px-3 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:ring-2 focus:ring-[#3A7AE0]/20 transition-all text-[#1A4786] font-medium hover:border-gray-300"
              />
            </div>
          </div>

          <div>
            <label
              for="report-form-type"
              class="block text-sm font-semibold text-[#1A4786] mb-2"
            >
              {$language === "id" ? "Jenis Formulir" : "Form Type"}
            </label>
            <select
              id="report-form-type"
              bind:value={reportFormType}
              class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:ring-2 focus:ring-[#3A7AE0]/20 transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%236b7280%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-size-[1.5em_1.5em] bg-position-[right_0.5rem_center] bg-no-repeat pr-10"
            >
              <option value="all"
                >{$language === "id" ? "Semua Formulir" : "All Forms"}</option
              >
              <option value="leave"
                >{$language === "id" ? "Cuti Saja" : "Leave Only"}</option
              >
              <option value="overtime"
                >{$language === "id" ? "Lembur Saja" : "Overtime Only"}</option
              >
              <option value="permission"
                >{$language === "id" ? "Izin Saja" : "Permission Only"}</option
              >
            </select>
          </div>

          <!-- Quick preset buttons -->
          <div class="space-y-2">
            <p
              class="text-xs font-semibold text-gray-500 uppercase tracking-wider"
            >
              {$language === "id" ? "Preset Cepat" : "Quick Presets"}
            </p>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                on:click={() => {
                  const now = new Date();
                  const start = new Date(
                    now.getFullYear(),
                    now.getMonth() - 1,
                    21
                  );
                  const end = new Date(now.getFullYear(), now.getMonth(), 20);
                  reportStartDate = start.toISOString().split("T")[0];
                  reportEndDate = end.toISOString().split("T")[0];
                }}
                class="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-all"
              >
                {$language === "id" ? "Bulan Ini" : "This Period"}
              </button>
              <button
                type="button"
                on:click={() => {
                  const now = new Date();
                  const start = new Date(now.getFullYear(), now.getMonth(), 1);
                  const end = new Date(
                    now.getFullYear(),
                    now.getMonth() + 1,
                    0
                  );
                  reportStartDate = start.toISOString().split("T")[0];
                  reportEndDate = end.toISOString().split("T")[0];
                }}
                class="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-all"
              >
                {$language === "id" ? "Bulan Kalender" : "Calendar Month"}
              </button>
              <button
                type="button"
                on:click={() => {
                  const now = new Date();
                  const start = new Date(
                    now.getFullYear(),
                    now.getMonth() - 2,
                    21
                  );
                  const end = new Date(
                    now.getFullYear(),
                    now.getMonth() - 1,
                    20
                  );
                  reportStartDate = start.toISOString().split("T")[0];
                  reportEndDate = end.toISOString().split("T")[0];
                }}
                class="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-all"
              >
                {$language === "id" ? "Periode Lalu" : "Last Period"}
              </button>
            </div>
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <button
            on:click={() => (showMonthlyReportModal = false)}
            class="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
            aria-label="Cancel report generation"
          >
            {$language === "id" ? "Batal" : "Cancel"}
          </button>
          <button
            on:click={printMonthlyReport}
            disabled={loading || !reportStartDate || !reportEndDate}
            class="flex-1 px-6 py-3 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] hover:shadow-lg hover:scale-105 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Generate and print report"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            {$language === "id" ? "Buat Laporan" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Comment Modal -->
  {#if commentModal.show}
    <div
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      on:click={closeCommentModal}
      on:keydown={(e) => e.key === "Escape" && closeCommentModal()}
      role="dialog"
      tabindex="-1"
      aria-modal="true"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
        on:click|stopPropagation
        on:keydown|stopPropagation
        role="presentation"
        in:fly={{ y: 20, duration: 300, easing: quintOut }}
      >
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-2xl font-bold text-[#1A4786]">
            {commentModal.action === "approve"
              ? $language === "id"
                ? "Catatan Persetujuan"
                : "Approval Note"
              : $language === "id"
                ? "Alasan Penolakan"
                : "Rejection Reason"}
          </h3>
          <button
            on:click={closeCommentModal}
            class="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg
              class="w-6 h-6"
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
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label
              for="comment-text"
              class="block text-sm font-semibold text-[#1A4786] mb-2"
            >
              {commentModal.action === "approve"
                ? $language === "id"
                  ? "Catatan (opsional)"
                  : "Note (optional)"
                : $language === "id"
                  ? "Alasan (wajib)"
                  : "Reason (required)"}
            </label>
            <textarea
              id="comment-text"
              bind:value={commentModal.comment}
              rows="4"
              placeholder={commentModal.action === "approve"
                ? $language === "id"
                  ? "Tambahkan catatan jika diperlukan..."
                  : "Add a note if needed..."
                : $language === "id"
                  ? "Jelaskan alasan penolakan..."
                  : "Explain reason for rejection..."}
              class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:ring-2 focus:ring-[#3A7AE0]/20 transition-all resize-none"
            ></textarea>
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <button
            on:click={closeCommentModal}
            class="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            {$language === "id" ? "Batal" : "Cancel"}
          </button>
          <button
            on:click={submitWithComment}
            disabled={loading ||
              (commentModal.action === "reject" &&
                !commentModal.comment.trim())}
            class="flex-1 px-6 py-3 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] hover:shadow-lg hover:scale-105 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {commentModal.action === "approve"
              ? $language === "id"
                ? "Setujui"
                : "Approve"
              : $language === "id"
                ? "Tolak"
                : "Reject"}
          </button>
        </div>
      </div>
    </div>
  {/if}
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
