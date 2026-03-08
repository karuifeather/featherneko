export default function printObject(obj: any, indent = 0) {
  const indentation = ' '.repeat(indent);

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      console.log(`${indentation}[${index}]`);
      printObject(item, indent + 2);
    });
  } else if (typeof obj === 'object' && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        console.log(`${indentation}${key}:`);
        printObject(value, indent + 2);
      } else {
        console.log(`${indentation}${key}: ${value}`);
      }
    });
  } else {
    console.log(`${indentation}${obj}`);
  }
}
