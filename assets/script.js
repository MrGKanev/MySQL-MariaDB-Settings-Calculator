
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

           function calculateSettings() {
        const totalMemory = parseFloat(document.getElementById('totalMemory').value) || 0;
        const reservedMemory = parseFloat(document.getElementById('reservedMemory').value) || 0;
        const otherTasksMemory = parseFloat(document.getElementById('otherTasksMemory').value) || 0;

        const errorElement = document.getElementById('error');
        if (reservedMemory + otherTasksMemory + 1 > totalMemory) {
            errorElement.textContent = "Error: Reserved memory + Other tasks memory + 1 GB cannot exceed total server memory.";
            errorElement.classList.remove('hidden');
        } else {
            errorElement.classList.add('hidden');
        }

        const availableMemory = Math.max(0, totalMemory - reservedMemory - otherTasksMemory);
        const totalMemoryBytes = availableMemory * 1024 * 1024 * 1024;

        const innodb_buffer_pool_size = Math.floor(totalMemoryBytes * 0.7);
        const max_connections = Math.floor(availableMemory * 100);
        const key_buffer_size = Math.floor(totalMemoryBytes * 0.1);
        const innodb_log_file_size = Math.floor(innodb_buffer_pool_size * 0.25);
        const query_cache_size = Math.floor(totalMemoryBytes * 0.05);
        const tmp_table_size = Math.floor(totalMemoryBytes * 0.05);
        const innodb_log_buffer_size = Math.min(Math.floor(totalMemoryBytes * 0.01), 8 * 1024 * 1024);

        // New settings
        const innodb_flush_log_at_trx_commit = 1;
        const innodb_flush_method = 'O_DIRECT';
        const innodb_file_per_table = 1;
        const innodb_io_capacity = Math.floor(availableMemory * 100);
        const innodb_read_io_threads = 4;
        const innodb_write_io_threads = 4;
        const innodb_thread_concurrency = 0;
        const sort_buffer_size = Math.min(Math.floor(totalMemoryBytes * 0.02), 262144);
        const read_buffer_size = Math.min(Math.floor(totalMemoryBytes * 0.01), 262144);
        const read_rnd_buffer_size = Math.min(Math.floor(totalMemoryBytes * 0.01), 524288);
        const join_buffer_size = Math.min(Math.floor(totalMemoryBytes * 0.01), 262144);

        const results = `
            <h2 class="text-xl font-semibold mb-3 text-blue-600">Memory Allocation</h2>
            <div class="grid grid-cols-2 gap-2 mb-4">
                <div>Total Server Memory:</div><div>${formatBytes(totalMemory * 1024 * 1024 * 1024)}</div>
                <div>Reserved for OS:</div><div>${formatBytes(reservedMemory * 1024 * 1024 * 1024)}</div>
                <div>Other Tasks:</div><div>${formatBytes(otherTasksMemory * 1024 * 1024 * 1024)}</div>
                <div class="font-semibold">Available for MySQL/MariaDB:</div><div class="font-semibold">${formatBytes(availableMemory * 1024 * 1024 * 1024)}</div>
            </div>
            <h2 class="text-xl font-semibold mb-3 text-blue-600">Recommended Settings</h2>
            <div class="grid grid-cols-2 gap-2">
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_buffer_pool_size" target="_blank" class="text-blue-500 hover:underline">innodb_buffer_pool_size</a> =</div><div>${formatBytes(innodb_buffer_pool_size)}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_max_connections" target="_blank" class="text-blue-500 hover:underline">max_connections</a> =</div><div>${max_connections}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_key_buffer_size" target="_blank" class="text-blue-500 hover:underline">key_buffer_size</a> =</div><div>${formatBytes(key_buffer_size)}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_log_file_size" target="_blank" class="text-blue-500 hover:underline">innodb_log_file_size</a> =</div><div>${formatBytes(innodb_log_file_size)}</div>
                <div><a href="https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_query_cache_size" target="_blank" class="text-blue-500 hover:underline">query_cache_size</a> =</div><div>${formatBytes(query_cache_size)}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_tmp_table_size" target="_blank" class="text-blue-500 hover:underline">tmp_table_size</a> =</div><div>${formatBytes(tmp_table_size)}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_log_buffer_size" target="_blank" class="text-blue-500 hover:underline">innodb_log_buffer_size</a> =</div><div>${formatBytes(innodb_log_buffer_size)}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_flush_log_at_trx_commit" target="_blank" class="text-blue-500 hover:underline">innodb_flush_log_at_trx_commit</a> =</div><div>${innodb_flush_log_at_trx_commit}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_flush_method" target="_blank" class="text-blue-500 hover:underline">innodb_flush_method</a> =</div><div>${innodb_flush_method}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_file_per_table" target="_blank" class="text-blue-500 hover:underline">innodb_file_per_table</a> =</div><div>${innodb_file_per_table}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_io_capacity" target="_blank" class="text-blue-500 hover:underline">innodb_io_capacity</a> =</div><div>${innodb_io_capacity}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_read_io_threads" target="_blank" class="text-blue-500 hover:underline">innodb_read_io_threads</a> =</div><div>${innodb_read_io_threads}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_write_io_threads" target="_blank" class="text-blue-500 hover:underline">innodb_write_io_threads</a> =</div><div>${innodb_write_io_threads}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-parameters.html#sysvar_innodb_thread_concurrency" target="_blank" class="text-blue-500 hover:underline">innodb_thread_concurrency</a> =</div><div>${innodb_thread_concurrency}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_sort_buffer_size" target="_blank" class="text-blue-500 hover:underline">sort_buffer_size</a> =</div><div>${formatBytes(sort_buffer_size)}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_read_buffer_size" target="_blank" class="text-blue-500 hover:underline">read_buffer_size</a> =</div><div>${formatBytes(read_buffer_size)}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_read_rnd_buffer_size" target="_blank" class="text-blue-500 hover:underline">read_rnd_buffer_size</a> =</div><div>${formatBytes(read_rnd_buffer_size)}</div>
                <div><a href="https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_join_buffer_size" target="_blank" class="text-blue-500 hover:underline">join_buffer_size</a> =</div><div>${formatBytes(join_buffer_size)}</div>
            </div>
            <p class="mt-4 text-sm text-gray-600">Note: These are general recommendations. Adjust based on your specific needs and workload.</p>
        `;

        document.getElementById('results').innerHTML = results;
    }

        function formatBytes(bytes) {
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            if (bytes === 0) return '0 Bytes';
            const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
            return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
        }

        const debouncedCalculate = debounce(calculateSettings, 300);

        function syncSliderAndInput(sliderId, inputId, max) {
            const slider = document.getElementById(sliderId);
            const input = document.getElementById(inputId);
            
            slider.addEventListener('input', function() {
                input.value = this.value;
                debouncedCalculate();
            });
            
            input.addEventListener('input', function() {
                let value = parseFloat(this.value);
                if (isNaN(value)) value = 0;
                if (value > max) value = max;
                this.value = value;
                slider.value = value;
                debouncedCalculate();
            });
        }

        syncSliderAndInput('totalMemorySlider', 'totalMemory', 128);
        syncSliderAndInput('reservedMemorySlider', 'reservedMemory', 16);
        syncSliderAndInput('otherTasksMemorySlider', 'otherTasksMemory', 16);

        // Set current year in footer
        document.getElementById('currentYear').textContent = new Date().getFullYear();

        // Initial calculation
        calculateSettings();