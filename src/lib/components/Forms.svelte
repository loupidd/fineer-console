<!-- src/lib/components/Forms.svelte -->
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

  // Declare variables before reactive statements to avoid "used before declaration"
  let isAdmin = false;
  let currentUserId = "";

  $: isAdmin = $authStore.userData?.role === "admin";
  $: currentUserId = $authStore.userData?.id;

  let activeForm = "leave";
  let loading = false;
  let submissions = [];

  // Leave Request Form
  let leaveForm = {
    type: "leave",
    reason: "",
    lateArrival: false,
    sick: false,
    earlyLeave: false,
    other: false,
    date: "",
    status: "pending",
  };

  // Overtime Form
  let overtimeForm = {
    type: "overtime",
    reason: "",
    workDescription: "",
    date: "",
    duration: "",
    status: "pending",
  };

  onMount(() => {
    loadSubmissions();
  });

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

      // Filter employee submissions if not admin
      if (!isAdmin && currentUserId) {
        allSubmissions = allSubmissions.filter(
          (s) => s.userId && s.userId === currentUserId
        );
      }

      // Sort by creation date (newest first)
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
      console.log("Loaded submissions:", submissions.length);
    } catch (error) {
      console.error("Error loading submissions:", error);
      alert("Error loading submissions: " + error.message);
    } finally {
      loading = false;
    }
  }

  async function submitLeaveRequest() {
    if (!leaveForm.reason || !leaveForm.date) {
      alert("Please fill in all required fields");
      return;
    }

    loading = true;
    try {
      await addDoc(collection(db, "forms"), {
        ...leaveForm,
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

  async function submitOvertimeRequest() {
    if (
      !overtimeForm.reason ||
      !overtimeForm.workDescription ||
      !overtimeForm.date ||
      !overtimeForm.duration
    ) {
      alert("Please fill in all required fields");
      return;
    }

    loading = true;
    try {
      await addDoc(collection(db, "forms"), {
        ...overtimeForm,
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

  async function updateStatus(formId, newStatus) {
    loading = true;
    try {
      await updateDoc(doc(db, "forms", formId), {
        status: newStatus,
        updatedAt: Timestamp.now(),
        approvedBy: $authStore.userData.name,
      });

      alert(`Form ${newStatus} successfully`);
      loadSubmissions();
    } catch (error) {
      console.error("Error updating form status:", error);
      alert("Failed to update form status");
    } finally {
      loading = false;
    }
  }

  function resetLeaveForm() {
    leaveForm = {
      type: "leave",
      reason: "",
      lateArrival: false,
      sick: false,
      earlyLeave: false,
      other: false,
      date: "",
      status: "pending",
    };
  }

  function resetOvertimeForm() {
    overtimeForm = {
      type: "overtime",
      reason: "",
      workDescription: "",
      date: "",
      duration: "",
      status: "pending",
    };
  }

  function formatDate(timestamp) {
    if (!timestamp) return "-";
    return new Date(timestamp.seconds * 1000).toLocaleString();
  }
</script>

<!-- ==================== HTML ==================== -->
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
  {#if !isAdmin}
    <!-- Employee Form Submission -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      <div class="p-6 border-b border-gray-100">
        <div class="flex gap-4">
          <button
            on:click={() => (activeForm = "leave")}
            class="px-4 py-2 rounded-lg font-medium transition {activeForm ===
            'leave'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
          >
            Leave Request
          </button>
          <button
            on:click={() => (activeForm = "overtime")}
            class="px-4 py-2 rounded-lg font-medium transition {activeForm ===
            'overtime'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
          >
            Overtime Request
          </button>
        </div>
      </div>

      <div class="p-6">
        {#if activeForm === "leave"}
          <!-- Leave Request Form -->
          <form on:submit|preventDefault={submitLeaveRequest} class="space-y-4">
            <div>
              <label
                for="leaveDate"
                class="block text-sm font-medium text-gray-700 mb-1">Date</label
              >
              <input
                id="leaveDate"
                type="date"
                bind:value={leaveForm.date}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <fieldset>
              <legend class="block text-sm font-medium text-gray-700 mb-2">
                Request Type
              </legend>
              <div class="space-y-2">
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    bind:checked={leaveForm.lateArrival}
                    class="mr-2"
                  />
                  <span class="text-sm text-gray-700">Late Arrival</span>
                </label>
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    bind:checked={leaveForm.sick}
                    class="mr-2"
                  />
                  <span class="text-sm text-gray-700">Sick Leave</span>
                </label>
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    bind:checked={leaveForm.earlyLeave}
                    class="mr-2"
                  />
                  <span class="text-sm text-gray-700">Early Leave</span>
                </label>
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    bind:checked={leaveForm.other}
                    class="mr-2"
                  />
                  <span class="text-sm text-gray-700">Other</span>
                </label>
              </div>
            </fieldset>

            <div>
              <label
                for="leaveReason"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Reason</label
              >
              <textarea
                id="leaveReason"
                bind:value={leaveForm.reason}
                required
                rows="4"
                placeholder="Explain your reason for leave..."
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={loading}
              class="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Submit Leave Request"}
            </button>
          </form>
        {:else}
          <!-- Overtime Request Form -->
          <form
            on:submit|preventDefault={submitOvertimeRequest}
            class="space-y-4"
          >
            <div>
              <label
                for="otDate"
                class="block text-sm font-medium text-gray-700 mb-1">Date</label
              >
              <input
                id="otDate"
                type="date"
                bind:value={overtimeForm.date}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                for="otDuration"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Duration (hours)</label
              >
              <input
                id="otDuration"
                type="number"
                bind:value={overtimeForm.duration}
                required
                min="1"
                placeholder="e.g., 2"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                for="otWorkDesc"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Work Description</label
              >
              <textarea
                id="otWorkDesc"
                bind:value={overtimeForm.workDescription}
                required
                rows="3"
                placeholder="Describe the work you will be doing..."
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              ></textarea>
            </div>

            <div>
              <label
                for="otReason"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Reason for Overtime</label
              >
              <textarea
                id="otReason"
                bind:value={overtimeForm.reason}
                required
                rows="3"
                placeholder="Explain why overtime is needed..."
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={loading}
              class="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Submit Overtime Request"}
            </button>
          </form>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Submissions List -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-100">
    <div class="p-6 border-b border-gray-100">
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-semibold text-gray-900">
          {isAdmin ? "All Submissions" : "My Submissions"}
        </h2>
        <button
          on:click={loadSubmissions}
          class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
        >
          Refresh
        </button>
      </div>
    </div>

    <div class="p-6">
      {#if loading}
        <div class="flex flex-col items-center justify-center py-12">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"
          ></div>
          <p class="mt-4 text-gray-500">Loading submissions...</p>
        </div>
      {:else if submissions.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-500">No submissions found</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each submissions as submission}
            <div
              class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
            >
              <div class="flex justify-between items-start mb-3">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full"
                    >
                      {submission.type === "leave"
                        ? "Leave Request"
                        : "Overtime Request"}
                    </span>
                    <span
                      class="px-2 py-1 text-xs font-medium rounded-full {submission.status ===
                      'approved'
                        ? 'bg-green-100 text-green-700'
                        : submission.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'}"
                    >
                      {submission.status}
                    </span>
                  </div>
                  <div class="text-sm text-gray-600">
                    <strong>{submission.userName}</strong>
                    ({submission.userNik})
                  </div>
                  <div class="text-xs text-gray-500 mt-1">
                    Submitted: {formatDate(submission.createdAt)}
                  </div>
                </div>

                {#if isAdmin && submission.status === "pending"}
                  <div class="flex gap-2">
                    <button
                      on:click={() => updateStatus(submission.id, "approved")}
                      disabled={loading}
                      class="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      on:click={() => updateStatus(submission.id, "rejected")}
                      disabled={loading}
                      class="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                {/if}
              </div>

              <div class="space-y-2 text-sm">
                <div><strong>Date:</strong> {submission.date}</div>
                {#if submission.type === "overtime"}
                  <div>
                    <strong>Duration:</strong>
                    {submission.duration} hours
                  </div>
                  <div>
                    <strong>Work Description:</strong>
                    {submission.workDescription}
                  </div>
                {/if}
                {#if submission.type === "leave"}
                  <div>
                    <strong>Type:</strong>
                    {#if submission.lateArrival}Late Arrival,
                    {/if}
                    {#if submission.sick}Sick Leave,
                    {/if}
                    {#if submission.earlyLeave}Early Leave,
                    {/if}
                    {#if submission.other}Other{/if}
                  </div>
                {/if}
                <div><strong>Reason:</strong> {submission.reason}</div>
                {#if submission.approvedBy}
                  <div class="text-xs text-gray-500 mt-2">
                    {submission.status === "approved" ? "Approved" : "Rejected"}
                    by: {submission.approvedBy}
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
