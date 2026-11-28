import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colour, font, layout } from '../theme';
import { Avatar } from './avatar';

/**
 * A square this size is sharp on the largest place an avatar is drawn (the profile)
 * and lands near 20 KB, far under the bucket's 200 KB limit: storage is the one thing
 * that could cost money (spec, Out of Scope).
 */
const EDGE = 320;
const QUALITY = 0.82;

/**
 * Story 6b: choosing a picture. The phone's own file input, because Safari offers the
 * camera and the photo library from it and no package is needed. The picture is
 * cropped to a centred square and shrunk here, before it goes anywhere.
 */
export function AvatarPicker({
  name,
  path,
  uri,
  busy = false,
  onChoose,
  onRemove,
}: {
  readonly name: string;
  readonly path?: string | null;
  readonly uri?: string | null;
  readonly busy?: boolean;
  readonly onChoose: (picture: Blob) => void;
  readonly onRemove: () => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const hasPicture = (uri ?? path ?? null) !== null;

  const choose = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file === undefined) return;
      squareJpeg(file).then(
        (picture) => {
          setProblem(null);
          onChoose(picture);
        },
        (error: unknown) => setProblem(error instanceof Error ? error.message : String(error)),
      );
    };
    input.click();
  };

  return (
    <View style={{ gap: 4 }}>
      <View style={[layout.row, { gap: 16 }]}>
        <Pressable accessibilityLabel="Chọn ảnh đại diện" accessibilityRole="button" disabled={busy} onPress={choose}>
          <Avatar name={name.trim().length === 0 ? '?' : name} path={path} size={72} uri={uri} />
        </Pressable>
        <View style={{ gap: 8, alignItems: 'flex-start' }}>
          {busy ? (
            <ActivityIndicator color={colour.courtInk} />
          ) : (
            <>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={choose}>
                <Text style={style.action}>{hasPicture ? 'Thay đổi ảnh đại diện' : 'Chọn ảnh đại diện'}</Text>
              </Pressable>
              {hasPicture ? (
                <Pressable accessibilityRole="button" hitSlop={8} onPress={onRemove}>
                  <Text style={[font.dim, { color: colour.down }]}>Xóa ảnh đại diện</Text>
                </Pressable>
              ) : (
                <Text style={font.dim}></Text>
              )}
            </>
          )}
        </View>
      </View>
      {problem === null ? null : <Text style={[font.dim, { color: colour.down }]}>{problem}</Text>}
    </View>
  );
}

async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(EDGE, side);
  canvas.height = canvas.width;

  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Trình duyệt này không xử lý được ảnh');
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob === null ? reject(new Error('Không đọc được ảnh này')) : resolve(blob)),
      'image/jpeg',
      QUALITY,
    ),
  );
}

const style = StyleSheet.create({
  action: { ...font.body, color: colour.courtInk, fontWeight: '600' },
});
