import * as crypto from 'crypto';
import * as fs from 'fs';

export function calculateFileMD5(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', error => reject(error));
  });
}

export function calculateDirMD5(dirPath: string): Promise<{[key: string]: string}> {
  return new Promise(async (resolve, reject) => {
    try {
      const result: {[key: string]: string} = {};
      const files = fs.readdirSync(dirPath);
      
      for(const file of files) {
        const fullPath = `${dirPath}/${file}`;
        if(fs.statSync(fullPath).isFile()) {
          result[file] = await calculateFileMD5(fullPath);
        }
      }
      
      resolve(result);
    } catch(error) {
      reject(error);
    }
  });
} 