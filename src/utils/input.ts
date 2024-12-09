import { createInterface } from 'readline';

// 获取用户输入
export async function getUserInput(prompt: string): Promise<string> {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        return await new Promise((resolve) => {
            rl.question(prompt, (answer) => {
                resolve(answer);
            });
        });
    } finally {
        rl.close();
    }
}

// 获取用户确认
export async function getUserConfirmation(prompt: string): Promise<boolean> {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        const answer = await new Promise<string>((resolve) => {
            rl.question(`${prompt} (Y/N): `, (answer) => {
                resolve(answer.trim().toUpperCase());
            });
        });
        return answer === 'Y';
    } finally {
        rl.close();
    }
} 
