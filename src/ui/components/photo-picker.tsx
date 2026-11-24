import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { colour, font, layout, radius } from '../theme';

/**
 * Long edge and quality chosen so a phone photo lands well under the bucket's 512 KB
 * limit: storage is the one thing that could cost money (spec, Out of Scope).
 */
const MAX_EDGE = 1280;
const QUALITY = 0.7;

/** Story 21: an optional photo, never a requirement. */
export function PhotoPicker({
  photo,
  onChange,
}: {
  readonly photo: Blob | null;
  readonly onChange: (photo: Blob | null) => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const choose = () => {
    // A plain file input, because Safari offers the camera and the library from it
    // and no package is needed for that.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file === undefined) return;
      shrink(file).then(
        (small) => {
          setProblem(null);
          setPreview(URL.createObjectURL(small));
          onChange(small);
        },
        (error: unknown) => setProblem(error instanceof Error ? error.message : String(error)),
      );
    };
    input.click();
  };

  if (photo !== null && preview !== null) {
    return (
      <View style={layout.row}>
        <Image source={{ uri: preview }} style={{ width: 64, height: 64, borderRadius: radius.field }} />
        <Pressable accessibilityRole="button" onPress={() => onChange(null)}>
          <Text style={[font.body, { color: colour.accent }]}>Remove photo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <Pressable accessibilityRole="button" onPress={choose}>
        <Text style={[font.body, { color: colour.accent }]}>Add a photo (optional)</Text>
      </Pressable>
      {problem === null ? null : <Text style={[font.dim, { color: colour.down }]}>{problem}</Text>}
    </View>
  );
}

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext('2d');
  if (context === null) throw new Error('this browser cannot resize photos');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob === null ? reject(new Error('the photo could not be read')) : resolve(blob)),
      'image/jpeg',
      QUALITY,
    ),
  );
}
