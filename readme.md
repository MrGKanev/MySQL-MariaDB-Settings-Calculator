# MySQL/MariaDB Settings Calculator

## Description

The MySQL/MariaDB Settings Calculator is a web-based tool designed to help database administrators and developers optimize their MySQL or MariaDB database settings based on their server's available memory. This calculator provides recommendations for key configuration parameters, ensuring better performance and resource utilization.

## Features

- Interactive memory allocation input using sliders and text fields
- Real-time calculation of recommended MySQL/MariaDB settings
- Comprehensive set of recommendations, including:
  - InnoDB buffer pool size
  - Max connections
  - Key buffer size
  - Query cache size
  - Tmp table size
  - InnoDB log file size and buffer size
  - Various InnoDB-specific settings
  - Sort, read, and join buffer sizes
- Links to official MySQL documentation for each setting
- Responsive design for both desktop and mobile devices
- FAQ section addressing common questions about database settings
- Useful links to MySQL and MariaDB tutorials and documentation

## Usage

1. Open the calculator in your web browser.
2. Use the sliders or input fields to specify:
   - Total Server Memory (GB)
   - Reserved Memory for OS (GB)
   - Memory for Other Tasks (GB)
3. The recommended settings will update automatically as you adjust the inputs.
4. Review the recommended settings in the results table.
5. Click on any setting name to view its official MySQL documentation for more information.
6. Consult the FAQ section for answers to common questions about database settings.
7. Use the provided links to access additional MySQL and MariaDB resources.

## Calculation Methods

The calculator uses the following methods to determine the recommended settings:

1. Available Memory:

   ```
   Available Memory = Total Server Memory - Reserved Memory for OS - Memory for Other Tasks
   ```

2. innodb_buffer_pool_size: 70% of available memory

   ```
   innodb_buffer_pool_size = Available Memory * 0.7
   ```

3. max_connections: 100 connections per GB of available memory

   ```
   max_connections = Available Memory (in GB) * 100
   ```

4. key_buffer_size: 10% of available memory

   ```
   key_buffer_size = Available Memory * 0.1
   ```

5. innodb_log_file_size: 25% of innodb_buffer_pool_size
  ```
  innodb_log_file_size = innodb_buffer_pool_size * 0.25
  ```

6. query_cache_size: 5% of available memory

   ```
   query_cache_size = Available Memory * 0.05
   ```

7. tmp_table_size: 5% of available memory

   ```
   tmp_table_size = Available Memory * 0.05
   ```

8. innodb_log_buffer_size: 1% of available memory, capped at 8MB

   ```
   innodb_log_buffer_size = min(Available Memory * 0.01, 8MB)
   ```

9. innodb_flush_log_at_trx_commit: Set to 1 for ACID compliance

10. innodb_flush_method: Set to 'O_DIRECT' for most cases

11. innodb_file_per_table: Set to 1 to enable

12. innodb_io_capacity: 100 IOPS per GB of available memory

    ```
    innodb_io_capacity = Available Memory (in GB) * 100
    ```

13. innodb_read_io_threads and innodb_write_io_threads: Set to 4 each

14. innodb_thread_concurrency: Set to 0 (auto-configure)

15. sort_buffer_size: 2% of available memory, capped at 262144 bytes

    ```
    sort_buffer_size = min(Available Memory * 0.02, 262144)
    ```

16. read_buffer_size: 1% of available memory, capped at 262144 bytes

    ```
    read_buffer_size = min(Available Memory * 0.01, 262144)
    ```

17. read_rnd_buffer_size: 1% of available memory, capped at 524288 bytes

    ```
    read_rnd_buffer_size = min(Available Memory * 0.01, 524288)
    ```

18. join_buffer_size: 1% of available memory, capped at 262144 bytes

    ```
    join_buffer_size = min(Available Memory * 0.01, 262144)
    ```

Please note that these calculations are based on general best practices and may need to be adjusted for specific use cases. Always monitor your database performance and adjust settings accordingly.

## Contributing

Contributions to the MySQL/MariaDB Settings Calculator are welcome! Here's how you can contribute:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/YourFeature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some feature'`)
5. Push to the branch (`git push origin feature/YourFeature`)
6. Open a Pull Request

Please ensure your code adheres to the existing style and that you've tested your changes thoroughly.

## Useful Commands

- Continuously watch for changes in the `style.css` file, updating the output file whenever changes occur.

```bash
npx tailwindcss -i ./src/input.css -o ./src/output.css --watch
```

- Generate a minified version of the CSS

```bash
npx tailwindcss -o ./src/output.css --minify 
```

## License

This project is open source and available under the [MIT License](LICENSE).

## Author

Created by [Gabriel Kanev](https://gkanev.com)

## Acknowledgments

- MySQL Documentation
- MariaDB Documentation
- All contributors who have helped improve this calculator

For any questions, issues, or suggestions, please open an issue on the GitHub repository.
