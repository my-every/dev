"use client";

import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ProjectActionPopover } from './project-action-popover';
import { ProjectIcon, type ProjectIconProps, UnitTypeIcon, type UnitTypeIconProps } from './project-icon';

export type IconSurfaceMode = 'display' | 'link' | 'popover';
export type IconSurfaceType = 'project' | 'unit';

interface IconSurfaceBase {
  mode?: IconSurfaceMode;
  iconType: IconSurfaceType;
  projectId: string;
  projectName: string;
  onNavigate?: (url: string) => void;
}

type ProjectVariant = IconSurfaceBase & {
  iconType: 'project';
  iconProps: Omit<ProjectIconProps, 'href' | 'onClick'>;
  linkHref?: string;
};

type UnitVariant = IconSurfaceBase & {
  iconType: 'unit';
  iconProps: Omit<UnitTypeIconProps, 'href' | 'onClick'>;
  linkHref?: string;
};

export type ProjectIconSurfaceProps = ProjectVariant | UnitVariant;

export function ProjectIconSurface(props: ProjectIconSurfaceProps) {
  const mode = props.mode ?? 'display';

  const trigger = useMemo(() => {
    if (props.iconType === 'project') {
      if (mode === 'link') {
        return <ProjectIcon {...props.iconProps} href={props.linkHref} />;
      }
      return <ProjectIcon {...props.iconProps} />;
    }
    if (mode === 'link') {
      return <UnitTypeIcon {...props.iconProps} href={props.linkHref} />;
    }
    return <UnitTypeIcon {...props.iconProps} />;
  }, [mode, props]);

  if (mode !== 'popover') {
    return trigger;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <ProjectActionPopover
          context={{ projectId: props.projectId, projectName: props.projectName }}
          onNavigate={props.onNavigate}
        />
      </PopoverContent>
    </Popover>
  );
}
