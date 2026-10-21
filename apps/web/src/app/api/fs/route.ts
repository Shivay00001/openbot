import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_ROOT = path.resolve(process.cwd(), '../..');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetPath = searchParams.get('path') || '';
    const readContent = searchParams.get('read') === 'true';

    const fullPath = path.resolve(WORKSPACE_ROOT, targetPath);

    // Prevent directory traversal outside workspace
    if (!fullPath.startsWith(WORKSPACE_ROOT)) {
      return NextResponse.json({ error: 'Access denied: outside workspace root' }, { status: 403 });
    }

    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async (entry) => {
          const itemPath = path.join(fullPath, entry.name);
          const relPath = path.relative(WORKSPACE_ROOT, itemPath);
          try {
            const itemStat = await fs.stat(itemPath);
            return {
              name: entry.name,
              path: relPath.replace(/\\/g, '/'),
              isDirectory: entry.isDirectory(),
              size: itemStat.size,
              updatedAt: itemStat.mtime,
            };
          } catch {
            return {
              name: entry.name,
              path: relPath.replace(/\\/g, '/'),
              isDirectory: entry.isDirectory(),
              size: 0,
              updatedAt: new Date(),
            };
          }
        })
      );

      // Sort directories first, then files
      items.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });

      return NextResponse.json({
        type: 'directory',
        path: path.relative(WORKSPACE_ROOT, fullPath).replace(/\\/g, '/') || '.',
        items,
      });
    } else {
      if (readContent) {
        const content = await fs.readFile(fullPath, 'utf-8');
        return NextResponse.json({
          type: 'file',
          path: path.relative(WORKSPACE_ROOT, fullPath).replace(/\\/g, '/'),
          size: stat.size,
          content,
        });
      } else {
        return NextResponse.json({
          type: 'file',
          path: path.relative(WORKSPACE_ROOT, fullPath).replace(/\\/g, '/'),
          size: stat.size,
        });
      }
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'File system operation failed' },
      { status: 500 }
    );
  }
}
