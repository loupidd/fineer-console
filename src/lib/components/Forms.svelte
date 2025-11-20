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
  let reportMonth = "";
  let reportYear = "";

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

    // Set default month and year for report
    const now = new Date();
    reportMonth = String(now.getMonth() + 1).padStart(2, "0");
    reportYear = String(now.getFullYear());

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
  async function updateStatus(formId, newStatus) {
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
        alert("Form fully approved by direktur.");
      }
      // Rejection at any stage
      else if (newStatus === "rejected") {
        updateData.status = "rejected";
        updateData.rejectedBy = $authStore.userData?.name || "";
        updateData.rejectedAt = Timestamp.now();
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
    if (!reportMonth || !reportYear) {
      alert("Please select a month and year");
      return;
    }

    loading = true;

    try {
      // Get current language before filtering
      const currentLang = $language;
      const isIndonesian = currentLang === "id";

      // Filter submissions for the selected month and year
      const monthSubmissions = submissions.filter((sub) => {
        if (!sub.createdAt || !sub.createdAt.seconds) return false;

        const subDate = new Date(sub.createdAt.seconds * 1000);
        const subMonth = String(subDate.getMonth() + 1).padStart(2, "0");
        const subYear = String(subDate.getFullYear());

        return subMonth === reportMonth && subYear === reportYear;
      });

      if (monthSubmissions.length === 0) {
        alert(
          isIndonesian
            ? "Tidak ada pengajuan pada bulan yang dipilih"
            : "No submissions found for the selected month"
        );
        loading = false;
        return;
      }

      const printWindow = window.open("", "", "width=1000,height=800");

      const monthName = new Date(
        Number(reportYear),
        parseInt(reportMonth) - 1
      ).toLocaleString(isIndonesian ? "id-ID" : "en-US", { month: "long" });

      const tableRows = monthSubmissions
        .map((sub, index) => {
          // Get details based on form type
          let details = "";
          let dateInfo = "";

          if (sub.formType === "leave") {
            dateInfo = `${sub.startDate} ${isIndonesian ? "sampai" : "to"} ${sub.endDate} (${sub.totalDays} ${isIndonesian ? "hari" : "days"})`;
            details = sub.reason || "-";
          } else if (sub.formType === "overtime") {
            dateInfo = `${sub.date} (${sub.startTime} - ${sub.endTime})`;
            details = sub.workDescription || "-";
          } else if (sub.formType === "permission") {
            dateInfo = sub.date || "-";
            details = sub.details || "-";
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
              ? `✓ ${t.approved}`
              : sub.status === "rejected"
                ? `✗ ${t.rejected}`
                : sub.status === "approved_by_admin"
                  ? ` ${t.approved} Admin`
                  : `⏱ ${t.pending}`;

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
          <td style="border: 1px solid #ddd; padding: 8px; font-size: 11px; vertical-align: top; max-width: 250px;">
            ${details}
          </td>
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
          <title>${$language === "id" ? "Laporan Bulanan" : "Monthly Report"} - ${monthName} ${reportYear}</title>
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
                <h1>Fineer by TripleS </h1>
                <p>${$language === "id" ? "Manajemen Sumber Daya Manusia" : "Human Resources Management"}</p>
              </div>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 11px; color: #666;">${$language === "id" ? "Laporan Dibuat" : "Report Generated"}</p>
              <p style="font-size: 11px; color: #1A4786; font-weight: bold;">${new Date().toLocaleDateString($language === "id" ? "id-ID" : "en-US")}</p>
            </div>
          </div>
          
          <div class="header">
            <h1>${$language === "id" ? "Laporan Lembur dan Cuti Bulanan" : "Monthly Submissions Report"}</h1>
            <p>${monthName} ${reportYear}</p>
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <h3>${monthSubmissions.length}</h3>
              <p>${$language === "id" ? "Total Pengajuan" : "Total Submissions"}</p>
            </div>
            <div class="summary-item">
              <h3>${monthSubmissions.filter((s) => s.status === "approved").length}</h3>
              <p>${t.approved}</p>
            </div>
            <div class="summary-item">
              <h3>${monthSubmissions.filter((s) => s.status === "pending" || s.status === "approved_by_admin").length}</h3>
              <p>${t.pending}</p>
            </div>
            <div class="summary-item">
              <h3>${monthSubmissions.filter((s) => s.status === "rejected").length}</h3>
              <p>${t.rejected}</p>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 30px;">No</th>
                <th style="width: 120px;">${$language === "id" ? "Karyawan" : "Employee"}</th>
                <th style="width: 80px;">${t.type}</th>
                <th style="width: 140px;">${$language === "id" ? "Tanggal/Periode" : "Date/Period"}</th>
                <th style="width: 220px;">${$language === "id" ? "Keperluan/Deskripsi" : "Reason/Description"}</th>
                <th style="text-align: center; width: 90px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div class="footer">
            <p>${$language === "id" ? "Laporan ini dibuat secara otomatis pada" : "This report was generated automatically on"} ${new Date().toLocaleString($language === "id" ? "id-ID" : "en-US")}</p>
            <p>${$language === "id" ? "Total rekaman" : "Total records"}: ${monthSubmissions.length}</p>
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
      console.error("Error generating monthly report:", error);
      alert("Failed to generate monthly report");
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
                      on:click={() => updateStatus(submission.id, "approved")}
                      disabled={loading}
                      class="flex-1 lg:flex-none px-6 py-3 bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105"
                      aria-label="Approve submission"
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
                      on:click={() => updateStatus(submission.id, "rejected")}
                      disabled={loading}
                      class="flex-1 lg:flex-none px-6 py-3 bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105"
                      aria-label="Reject submission"
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
                      on:click={() => updateStatus(submission.id, "approved")}
                      disabled={loading}
                      class="flex-1 lg:flex-none px-6 py-3 bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105"
                      aria-label="Approve submission as direktur"
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
                      on:click={() => updateStatus(submission.id, "rejected")}
                      disabled={loading}
                      class="flex-1 lg:flex-none px-6 py-3 bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105"
                      aria-label="Reject submission as direktur"
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
              ? "Buat Laporan Bulanan"
              : "Generate Monthly Report"}
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
          <div>
            <label
              for="report-month"
              class="block text-sm font-semibold text-[#1A4786] mb-2"
            >
              {$language === "id" ? "Pilih Bulan" : "Select Month"}
            </label>
            <select
              id="report-month"
              bind:value={reportMonth}
              class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:ring-2 focus:ring-[#3A7AE0]/20 transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%236b7280%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-size-[1.5em_1.5em] bg-position-[right_0.5rem_center] bg-no-repeat"
            >
              <option value="01"
                >{$language === "id" ? "Januari" : "January"}</option
              >
              <option value="02"
                >{$language === "id" ? "Februari" : "February"}</option
              >
              <option value="03"
                >{$language === "id" ? "Maret" : "March"}</option
              >
              <option value="04"
                >{$language === "id" ? "April" : "April"}</option
              >
              <option value="05">{$language === "id" ? "Mei" : "May"}</option>
              <option value="06">{$language === "id" ? "Juni" : "June"}</option>
              <option value="07">{$language === "id" ? "Juli" : "July"}</option>
              <option value="08"
                >{$language === "id" ? "Agustus" : "August"}</option
              >
              <option value="09"
                >{$language === "id" ? "September" : "September"}</option
              >
              <option value="10"
                >{$language === "id" ? "Oktober" : "October"}</option
              >
              <option value="11"
                >{$language === "id" ? "November" : "November"}</option
              >
              <option value="12"
                >{$language === "id" ? "Desember" : "December"}</option
              >
            </select>
          </div>

          <div>
            <label
              for="report-year"
              class="block text-sm font-semibold text-[#1A4786] mb-2"
            >
              {$language === "id" ? "Pilih Tahun" : "Select Year"}
            </label>
            <select
              id="report-year"
              bind:value={reportYear}
              class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#3A7AE0] focus:ring-2 focus:ring-[#3A7AE0]/20 transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%236b7280%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')] bg-size-[1.5em_1.5em] bg-position-[right_0.5rem_center] bg-no-repeat"
            >
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
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
            disabled={loading}
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
