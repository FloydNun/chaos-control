
import React, { useState } from 'react';
import { FolderNode, FileMetadata } from '../types';

interface FileTreeProps {
  node: FolderNode;
  onSelect: (node: FolderNode | FileMetadata) => void;
  depth?: number;
}

const FileTree: React.FC<FileTreeProps> = ({ node, onSelect, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(depth < 1);

  const isFolder = (item: any): item is FolderNode => 'children' in item;

  return (
    <div className="select-none">
      <div 
        onClick={() => {
          setIsOpen(!isOpen);
          onSelect(node);
        }}
        className={`group flex items-center gap-2 py-1.5 px-3 rounded-lg cursor-pointer transition-colors ${
          node.entropy && node.entropy > 50 ? 'bg-rose-500/5 hover:bg-rose-500/10' : 'hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        <span className="text-slate-500">
          {isOpen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          )}
        </span>
        <span className={node.entropy && node.entropy > 70 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
          {isFolder(node) ? (
            <svg className="inline mr-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
          ) : (
            <svg className="inline mr-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          )}
          {node.name}
        </span>
        {node.projectType && (
          <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 rounded-full uppercase font-black">
            {node.projectType}
          </span>
        )}
      </div>
      
      {isOpen && node.children && (
        <div className="mt-0.5">
          {node.children.map((child, idx) => (
            isFolder(child) ? (
              <FileTree key={idx} node={child} onSelect={onSelect} depth={depth + 1} />
            ) : (
              <div 
                key={idx} 
                onClick={() => onSelect(child)}
                className="flex items-center gap-2 py-1 px-3 hover:bg-white/5 cursor-pointer text-slate-400 text-sm"
                style={{ paddingLeft: `${(depth + 1) * 16 + 28}px` }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                {child.name}
                <span className="text-[10px] text-slate-600 font-mono ml-auto">
                  {(child.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
};

export default FileTree;
