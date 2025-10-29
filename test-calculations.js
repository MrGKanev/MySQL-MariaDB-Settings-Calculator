// Test script for MySQL calculations
import { mysqlCalculator } from './assets/js/calculations.js';
import { templateManager } from './assets/js/templates.js';
import { formatBytes } from './assets/js/utils.js';

console.log('=== MySQL Calculator Test Suite ===\n');

// Test 1: Default 16GB server with 1GB reserved for OS
console.log('Test 1: 16GB server with 1GB reserved for OS');
const test1 = {
    totalMemory: 16,
    reservedMemory: 1,
    otherTasksMemory: 0,
    osType: 'linux',
    storageType: 'ssd'
};

const results1 = mysqlCalculator.calculate(test1, null);
const score1 = mysqlCalculator.calculatePerformanceScore(results1);

console.log('- Total Memory:', test1.totalMemory, 'GB');
console.log('- Reserved Memory:', test1.reservedMemory, 'GB');
console.log('- Available Memory:', results1.inputs.availableMemory, 'GB');
console.log('- Buffer Pool Size:', formatBytes(results1.calculations.innodb_buffer_pool_size));
console.log('- Performance Score:', score1.totalScore);
console.log('- Validation Errors:', results1.validationErrors || 'None');
console.log('');

// Test 2: Large 128GB server with 8GB reserved
console.log('Test 2: 128GB server with 8GB reserved for OS');
const test2 = {
    totalMemory: 128,
    reservedMemory: 8,
    otherTasksMemory: 0,
    osType: 'linux',
    storageType: 'nvme'
};

const results2 = mysqlCalculator.calculate(test2, null);
const score2 = mysqlCalculator.calculatePerformanceScore(results2);

console.log('- Total Memory:', test2.totalMemory, 'GB');
console.log('- Reserved Memory:', test2.reservedMemory, 'GB');
console.log('- Available Memory:', results2.inputs.availableMemory, 'GB');
console.log('- Buffer Pool Size:', formatBytes(results2.calculations.innodb_buffer_pool_size));
console.log('- Performance Score:', score2.totalScore);
console.log('- Validation Errors:', results2.validationErrors || 'None');
console.log('');

// Test 3: Small 4GB server with 0.5GB reserved
console.log('Test 3: 4GB server with 0.5GB reserved for OS');
const test3 = {
    totalMemory: 4,
    reservedMemory: 0.5,
    otherTasksMemory: 0,
    osType: 'linux',
    storageType: 'ssd'
};

const results3 = mysqlCalculator.calculate(test3, null);
const score3 = mysqlCalculator.calculatePerformanceScore(results3);

console.log('- Total Memory:', test3.totalMemory, 'GB');
console.log('- Reserved Memory:', test3.reservedMemory, 'GB');
console.log('- Available Memory:', results3.inputs.availableMemory, 'GB');
console.log('- Buffer Pool Size:', formatBytes(results3.calculations.innodb_buffer_pool_size));
console.log('- Performance Score:', score3.totalScore);
console.log('- Validation Errors:', results3.validationErrors || 'None');
console.log('');

// Test 4: Very large 256GB server with 32GB reserved
console.log('Test 4: 256GB server with 32GB reserved for OS');
const test4 = {
    totalMemory: 256,
    reservedMemory: 32,
    otherTasksMemory: 0,
    osType: 'linux',
    storageType: 'nvme'
};

const results4 = mysqlCalculator.calculate(test4, null);
const score4 = mysqlCalculator.calculatePerformanceScore(results4);

console.log('- Total Memory:', test4.totalMemory, 'GB');
console.log('- Reserved Memory:', test4.reservedMemory, 'GB');
console.log('- Available Memory:', results4.inputs.availableMemory, 'GB');
console.log('- Buffer Pool Size:', formatBytes(results4.calculations.innodb_buffer_pool_size));
console.log('- Performance Score:', score4.totalScore);
console.log('- Validation Errors:', results4.validationErrors || 'None');
console.log('');

console.log('=== All tests completed successfully! ===');
