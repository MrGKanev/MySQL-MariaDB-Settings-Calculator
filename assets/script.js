function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Global variables to store settings for use across functions
let globalSettings = {};

function calculateSettings() {
  const totalMemory =
    parseFloat(document.getElementById("totalMemory").value) || 0;
  const reservedMemory =
    parseFloat(document.getElementById("reservedMemory").value) || 0;
  const otherTasksMemory =
    parseFloat(document.getElementById("otherTasksMemory").value) || 0;

  const errorElement = document.getElementById("error");
  if (reservedMemory + otherTasksMemory + 1 > totalMemory) {
    errorElement.textContent =
      "Error: Reserved memory + Other tasks memory + 1 GB cannot exceed total server memory.";
    errorElement.classList.remove("hidden");
  } else {
    errorElement.classList.add("hidden");
  }

  const availableMemory = Math.max(
    0,
    totalMemory - reservedMemory - otherTasksMemory
  );
  const totalMemoryBytes = availableMemory * 1024 * 1024 * 1024;

  const innodb_buffer_pool_size = Math.floor(totalMemoryBytes * 0.7);
  const max_connections = Math.floor(availableMemory * 100);
  const key_buffer_size = Math.floor(totalMemoryBytes * 0.1);
  const innodb_log_file_size = Math.floor(innodb_buffer_pool_size * 0.25);
  const query_cache_size = Math.floor(totalMemoryBytes * 0.05);
  const tmp_table_size = Math.floor(totalMemoryBytes * 0.05);
  const innodb_log_buffer_size = Math.min(
    Math.floor(totalMemoryBytes * 0.01),
    8 * 1024 * 1024
  );

  // New settings
  const innodb_flush_log_at_trx_commit = 1;
  const innodb_flush_method = "O_DIRECT";
  const innodb_file_per_table = 1;
  const innodb_io_capacity = Math.floor(availableMemory * 100);
  const innodb_read_io_threads = 4;
  const innodb_write_io_threads = 4;
  const innodb_thread_concurrency = 0;
  const sort_buffer_size = Math.min(
    Math.floor(totalMemoryBytes * 0.02),
    262144
  );
  const read_buffer_size = Math.min(
    Math.floor(totalMemoryBytes * 0.01),
    262144
  );
  const read_rnd_buffer_size = Math.min(
    Math.floor(totalMemoryBytes * 0.01),
    524288
  );
  const join_buffer_size = Math.min(
    Math.floor(totalMemoryBytes * 0.01),
    262144
  );

  const results = `
        <h2 class="text-xl font-semibold mb-3 text-blue-600">Memory Allocation</h2>
        <div class="grid grid-cols-2 gap-2 mb-4">
            <div>Total Server Memory:</div><div>${formatBytes(
              totalMemory * 1024 * 1024 * 1024
            )}</div>
            <div>Reserved for OS:</div><div>${formatBytes(
              reservedMemory * 1024 * 1024 * 1024
            )}</div>
            <div>Other Tasks:</div><div>${formatBytes(
              otherTasksMemory * 1024 * 1024 * 1024
            )}</div>
            <div class="font-semibold">Available for MySQL/MariaDB:</div><div class="font-semibold">${formatBytes(
              availableMemory * 1024 * 1024 * 1024
            )}</div>
        </div>
        <h2 class="text-xl font-semibold mb-3 text-blue-600">Recommended Settings</h2>
        <div class="grid grid-cols-2 gap-2">
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_buffer_pool_size" target="_blank" class="text-blue-500 hover:underline">innodb_buffer_pool_size</a> =</div><div>${formatBytes(
              innodb_buffer_pool_size
            )}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_max_connections" target="_blank" class="text-blue-500 hover:underline">max_connections</a> =</div><div>${max_connections}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_key_buffer_size" target="_blank" class="text-blue-500 hover:underline">key_buffer_size</a> =</div><div>${formatBytes(
              key_buffer_size
            )}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_log_file_size" target="_blank" class="text-blue-500 hover:underline">innodb_log_file_size</a> =</div><div>${formatBytes(
              innodb_log_file_size
            )}</div>
            <div><a href="https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_query_cache_size" target="_blank" class="text-blue-500 hover:underline">query_cache_size</a> =</div><div>${formatBytes(
              query_cache_size
            )}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_tmp_table_size" target="_blank" class="text-blue-500 hover:underline">tmp_table_size</a> =</div><div>${formatBytes(
              tmp_table_size
            )}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_log_buffer_size" target="_blank" class="text-blue-500 hover:underline">innodb_log_buffer_size</a> =</div><div>${formatBytes(
              innodb_log_buffer_size
            )}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_flush_log_at_trx_commit" target="_blank" class="text-blue-500 hover:underline">innodb_flush_log_at_trx_commit</a> =</div><div>${innodb_flush_log_at_trx_commit}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_flush_method" target="_blank" class="text-blue-500 hover:underline">innodb_flush_method</a> =</div><div>${innodb_flush_method}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_file_per_table" target="_blank" class="text-blue-500 hover:underline">innodb_file_per_table</a> =</div><div>${innodb_file_per_table}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_io_capacity" target="_blank" class="text-blue-500 hover:underline">innodb_io_capacity</a> =</div><div>${innodb_io_capacity}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_read_io_threads" target="_blank" class="text-blue-500 hover:underline">innodb_read_io_threads</a> =</div><div>${innodb_read_io_threads}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_write_io_threads" target="_blank" class="text-blue-500 hover:underline">innodb_write_io_threads</a> =</div><div>${innodb_write_io_threads}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_thread_concurrency" target="_blank" class="text-blue-500 hover:underline">innodb_thread_concurrency</a> =</div><div>${innodb_thread_concurrency}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_sort_buffer_size" target="_blank" class="text-blue-500 hover:underline">sort_buffer_size</a> =</div><div>${formatBytes(
              sort_buffer_size
            )}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_read_buffer_size" target="_blank" class="text-blue-500 hover:underline">read_buffer_size</a> =</div><div>${formatBytes(
              read_buffer_size
            )}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_read_rnd_buffer_size" target="_blank" class="text-blue-500 hover:underline">read_rnd_buffer_size</a> =</div><div>${formatBytes(
              read_rnd_buffer_size
            )}</div>
            <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_join_buffer_size" target="_blank" class="text-blue-500 hover:underline">join_buffer_size</a> =</div><div>${formatBytes(
              join_buffer_size
            )}</div>
        </div>
        <p class="mt-4 text-sm text-zinc-600">Note: These are general recommendations. Adjust based on your specific needs and workload.</p>
    `;

  document.getElementById("results").innerHTML = results;

  // Store settings globally for use in other functions
  globalSettings = {
    totalMemory,
    reservedMemory,
    otherTasksMemory,
    availableMemory,
    innodb_buffer_pool_size,
    max_connections,
    key_buffer_size,
    innodb_log_file_size,
    query_cache_size,
    tmp_table_size,
    innodb_log_buffer_size,
    innodb_flush_log_at_trx_commit,
    innodb_flush_method,
    innodb_file_per_table,
    innodb_io_capacity,
    innodb_read_io_threads,
    innodb_write_io_threads,
    innodb_thread_concurrency,
    sort_buffer_size,
    read_buffer_size,
    read_rnd_buffer_size,
    join_buffer_size,
  };

  // Calculate performance score
  calculatePerformanceScore();

  // Hide the config output when settings change
  document.getElementById("configOutput").classList.add("hidden");
  document.getElementById("copyConfigBtn").classList.add("hidden");
  document.getElementById("downloadConfigBtn").classList.add("hidden");
}

function formatBytes(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
}

const debouncedCalculate = debounce(calculateSettings, 300);

function syncSliderAndInput(sliderId, inputId, max) {
  const slider = document.getElementById(sliderId);
  const input = document.getElementById(inputId);

  slider.addEventListener("input", function () {
    input.value = this.value;
    debouncedCalculate();
  });

  input.addEventListener("input", function () {
    let value = parseFloat(this.value);
    if (isNaN(value)) value = 0;
    if (value > max) value = max;
    this.value = value;
    slider.value = value;
    debouncedCalculate();
  });
}

syncSliderAndInput("totalMemorySlider", "totalMemory", 128);
syncSliderAndInput("reservedMemorySlider", "reservedMemory", 16);
syncSliderAndInput("otherTasksMemorySlider", "otherTasksMemory", 16);

// Set current year in footer
document.getElementById("currentYear").textContent = new Date().getFullYear();

// Function to generate my.cnf file
function generateMyCnfFile() {
  const {
    innodb_buffer_pool_size,
    max_connections,
    key_buffer_size,
    innodb_log_file_size,
    query_cache_size,
    tmp_table_size,
    innodb_log_buffer_size,
    innodb_flush_log_at_trx_commit,
    innodb_flush_method,
    innodb_file_per_table,
    innodb_io_capacity,
    innodb_read_io_threads,
    innodb_write_io_threads,
    innodb_thread_concurrency,
    sort_buffer_size,
    read_buffer_size,
    read_rnd_buffer_size,
    join_buffer_size,
  } = globalSettings;

  const configContent = `# MySQL/MariaDB Configuration File
# Generated by MySQL/MariaDB Settings Calculator (https://gkanev.com/mysql-calculator)
# Generated on: ${new Date().toISOString().split("T")[0]}

[mysqld]
# Basic Settings
user                           = mysql
pid-file                       = /var/run/mysqld/mysqld.pid
socket                         = /var/run/mysqld/mysqld.sock
port                           = 3306
basedir                        = /usr
datadir                        = /var/lib/mysql
tmpdir                         = /tmp
lc-messages-dir                = /usr/share/mysql

# Memory Settings
innodb_buffer_pool_size        = ${innodb_buffer_pool_size}
key_buffer_size                = ${key_buffer_size}
query_cache_size               = ${query_cache_size}
tmp_table_size                 = ${tmp_table_size}
max_heap_table_size            = ${tmp_table_size}
sort_buffer_size               = ${sort_buffer_size}
read_buffer_size               = ${read_buffer_size}
read_rnd_buffer_size           = ${read_rnd_buffer_size}
join_buffer_size               = ${join_buffer_size}

# Connection Settings
max_connections                = ${max_connections}
max_allowed_packet             = 16M
thread_cache_size              = 128

# InnoDB Settings
innodb_log_file_size           = ${innodb_log_file_size}
innodb_log_buffer_size         = ${innodb_log_buffer_size}
innodb_flush_log_at_trx_commit = ${innodb_flush_log_at_trx_commit}
innodb_flush_method            = ${innodb_flush_method}
innodb_file_per_table          = ${innodb_file_per_table}
innodb_io_capacity             = ${innodb_io_capacity}
innodb_read_io_threads         = ${innodb_read_io_threads}
innodb_write_io_threads        = ${innodb_write_io_threads}
innodb_thread_concurrency      = ${innodb_thread_concurrency}

# Logging
log_error                      = /var/log/mysql/error.log
slow_query_log                 = 1
slow_query_log_file            = /var/log/mysql/mysql-slow.log
long_query_time                = 2
log_slow_admin_statements      = ON
log_slow_slave_statements      = ON

# Replication
server-id                      = 1
log_bin                        = /var/log/mysql/mysql-bin.log
expire_logs_days               = 10
max_binlog_size                = 100M
binlog_format                  = ROW

# Security
symbolic-links                 = 0

[client]
socket                         = /var/run/mysqld/mysqld.sock

[mysqldump]
quick
quote-names
max_allowed_packet             = 16M
`;

  const configOutput = document.getElementById("configOutput");
  const configContent_elem = document.getElementById("configContent");
  configContent_elem.textContent = configContent;
  configOutput.classList.remove("hidden");

  // Show copy and download buttons
  document.getElementById("copyConfigBtn").classList.remove("hidden");
  document.getElementById("downloadConfigBtn").classList.remove("hidden");

  return configContent;
}

// Function to copy config to clipboard
function copyConfigToClipboard() {
  const configContent = document.getElementById("configContent").textContent;
  navigator.clipboard
    .writeText(configContent)
    .then(() => {
      // Temporarily change button text to indicate success
      const copyBtn = document.getElementById("copyConfigBtn");
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("bg-green-700");

      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.classList.remove("bg-green-700");
      }, 2000);
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
      alert("Failed to copy to clipboard. Please try again.");
    });
}

// Function to download config file
function downloadConfigFile() {
  const configContent = document.getElementById("configContent").textContent;
  const blob = new Blob([configContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "my.cnf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Function to calculate performance score
function calculatePerformanceScore() {
  const {
    totalMemory,
    availableMemory,
    innodb_buffer_pool_size,
    max_connections,
    innodb_log_file_size,
    innodb_flush_log_at_trx_commit,
    innodb_io_capacity,
    innodb_read_io_threads,
    innodb_write_io_threads,
  } = globalSettings;

  // Calculate individual scores (each out of 20 points)
  const scores = {
    memoryAllocation: 0,
    bufferPoolSize: 0,
    logFileSize: 0,
    connections: 0,
    ioSettings: 0,
  };

  // Memory allocation score - how much of total memory is available for MySQL
  const memoryRatio = availableMemory / totalMemory;
  scores.memoryAllocation = Math.min(20, Math.round(memoryRatio * 25)); // Higher ratio is better

  // Buffer pool size score - ideally 70-80% of available memory
  const bufferPoolRatio =
    innodb_buffer_pool_size / (availableMemory * 1024 * 1024 * 1024);
  scores.bufferPoolSize = Math.round(
    20 - Math.abs(0.75 - bufferPoolRatio) * 40
  ); // Closer to 75% is better

  // Log file size score - ideally 25% of buffer pool
  const logFileRatio = innodb_log_file_size / innodb_buffer_pool_size;
  scores.logFileSize = Math.round(20 - Math.abs(0.25 - logFileRatio) * 80); // Closer to 25% is better

  // Connections score - ideally not too many connections per GB
  const connectionsPerGB = max_connections / availableMemory;
  scores.connections =
    connectionsPerGB <= 150
      ? 20
      : Math.max(0, 20 - (connectionsPerGB - 150) / 10);

  // IO settings score - based on io capacity and io threads
  const ioCapacityScore = Math.min(10, innodb_io_capacity / 200);
  const ioThreadsScore = Math.min(
    10,
    (innodb_read_io_threads + innodb_write_io_threads) / 2
  );
  scores.ioSettings = Math.round(ioCapacityScore + ioThreadsScore);

  // Calculate total score (out of 100)
  const totalScore = Object.values(scores).reduce(
    (sum, score) => sum + score,
    0
  );

  // Update the circular progress bar
  const scoreCircle = document.getElementById("scoreCircle");
  const circumference = 2 * Math.PI * 45; // 45 is the radius of the circle
  const offset = circumference - (totalScore / 100) * circumference;
  scoreCircle.style.strokeDasharray = `${circumference} ${circumference}`;
  scoreCircle.style.strokeDashoffset = offset;

  // Update score color based on value
  if (totalScore >= 80) {
    scoreCircle.style.stroke = "#10b981"; // Green
  } else if (totalScore >= 60) {
    scoreCircle.style.stroke = "#3b82f6"; // Blue
  } else if (totalScore >= 40) {
    scoreCircle.style.stroke = "#f59e0b"; // Yellow/Orange
  } else {
    scoreCircle.style.stroke = "#ef4444"; // Red
  }

  // Update score value
  document.getElementById("scoreValue").textContent = totalScore;

  // Update breakdown
  const breakdownHTML = `
        <div class="bg-zinc-50 p-3 rounded-md">
            <div class="text-sm font-medium">Memory Allocation</div>
            <div class="flex items-center mt-1">
                <div class="bg-zinc-200 h-2 rounded-full flex-grow">
                    <div class="bg-blue-500 h-2 rounded-full" style="width: ${
                      scores.memoryAllocation * 5
                    }%"></div>
                </div>
                <span class="ml-2 text-sm font-medium">${
                  scores.memoryAllocation
                }/20</span>
            </div>
        </div>
        <div class="bg-zinc-50 p-3 rounded-md">
            <div class="text-sm font-medium">Buffer Pool Size</div>
            <div class="flex items-center mt-1">
                <div class="bg-zinc-200 h-2 rounded-full flex-grow">
                    <div class="bg-blue-500 h-2 rounded-full" style="width: ${
                      scores.bufferPoolSize * 5
                    }%"></div>
                </div>
                <span class="ml-2 text-sm font-medium">${
                  scores.bufferPoolSize
                }/20</span>
            </div>
        </div>
        <div class="bg-zinc-50 p-3 rounded-md">
            <div class="text-sm font-medium">Log File Size</div>
            <div class="flex items-center mt-1">
                <div class="bg-zinc-200 h-2 rounded-full flex-grow">
                    <div class="bg-blue-500 h-2 rounded-full" style="width: ${
                      scores.logFileSize * 5
                    }%"></div>
                </div>
                <span class="ml-2 text-sm font-medium">${
                  scores.logFileSize
                }/20</span>
            </div>
        </div>
        <div class="bg-zinc-50 p-3 rounded-md">
            <div class="text-sm font-medium">Connection Settings</div>
            <div class="flex items-center mt-1">
                <div class="bg-zinc-200 h-2 rounded-full flex-grow">
                    <div class="bg-blue-500 h-2 rounded-full" style="width: ${
                      scores.connections * 5
                    }%"></div>
                </div>
                <span class="ml-2 text-sm font-medium">${Math.round(
                  scores.connections
                )}/20</span>
            </div>
        </div>
        <div class="bg-zinc-50 p-3 rounded-md">
            <div class="text-sm font-medium">I/O Settings</div>
            <div class="flex items-center mt-1">
                <div class="bg-zinc-200 h-2 rounded-full flex-grow">
                    <div class="bg-blue-500 h-2 rounded-full" style="width: ${
                      scores.ioSettings * 5
                    }%"></div>
                </div>
                <span class="ml-2 text-sm font-medium">${
                  scores.ioSettings
                }/20</span>
            </div>
        </div>
    `;

  document.getElementById("scoreBreakdown").innerHTML = breakdownHTML;

  // Generate recommendations based on scores
  const recommendations = [];

  if (scores.memoryAllocation < 15) {
    recommendations.push(
      "Consider allocating more memory to MySQL by reducing the reserved memory or memory for other tasks."
    );
  }

  if (scores.bufferPoolSize < 15) {
    if (bufferPoolRatio < 0.6) {
      recommendations.push(
        "Increase your innodb_buffer_pool_size to around 70-80% of available memory for better performance."
      );
    } else if (bufferPoolRatio > 0.85) {
      recommendations.push(
        "Your innodb_buffer_pool_size may be too large. Consider reducing it to leave some memory for other operations."
      );
    }
  }

  if (scores.logFileSize < 15) {
    if (logFileRatio < 0.2) {
      recommendations.push(
        "Increase your innodb_log_file_size to about 25% of your buffer pool size for better transaction performance."
      );
    } else if (logFileRatio > 0.3) {
      recommendations.push(
        "Your innodb_log_file_size may be too large relative to buffer pool size."
      );
    }
  }

  if (scores.connections < 15) {
    recommendations.push(
      "Your max_connections setting may be too high for your available memory. Consider reducing it to avoid server overload."
    );
  }

  if (scores.ioSettings < 15) {
    if (innodb_io_capacity < availableMemory * 50) {
      recommendations.push(
        "Consider increasing innodb_io_capacity based on your storage capabilities."
      );
    }
    if (innodb_read_io_threads < 4 || innodb_write_io_threads < 4) {
      recommendations.push(
        "Increase innodb_read_io_threads and innodb_write_io_threads to at least 4 each for better I/O performance."
      );
    }
  }

  // If everything looks good
  if (recommendations.length === 0) {
    recommendations.push(
      "Your MySQL/MariaDB configuration looks well optimized. Monitor your specific workload performance to make further adjustments if needed."
    );
  }

  // Update recommendations list
  const recommendationsHTML = recommendations
    .map((rec) => `<li>${rec}</li>`)
    .join("");
  document
    .getElementById("scoreRecommendations")
    .querySelector("ul").innerHTML = recommendationsHTML;
}

// Event listeners for the buttons
document
  .getElementById("generateConfigBtn")
  .addEventListener("click", generateMyCnfFile);
document
  .getElementById("copyConfigBtn")
  .addEventListener("click", copyConfigToClipboard);
document
  .getElementById("downloadConfigBtn")
  .addEventListener("click", downloadConfigFile);

// Initial calculation
calculateSettings();
