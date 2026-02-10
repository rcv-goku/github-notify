import say from 'say';

export function speak(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    say.speak(text, undefined, undefined, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function stopSpeaking(): void {
  say.stop();
}
