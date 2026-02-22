// src/builder/RightSidebar.tsx
import React from "react";
import { Collapse } from "antd";

export default function RightSidebar(props: {
  timeline?: React.ReactNode;
  course: React.ReactNode;
  flags: React.ReactNode;
  inspector: React.ReactNode;
  project: React.ReactNode;
  rrs?: React.ReactNode;
}) {
  const { timeline, course, flags, inspector, project, rrs } = props;

  return (
    <Collapse
      bordered={false}
      defaultActiveKey={["inspector"]}
      items={[
        ...(timeline
          ? [{ key: "timeline", label: "Timeline", children: timeline }]
          : []),
        { key: "course", label: "Course", children: course },
        { key: "flags", label: "Flags", children: flags },
        { key: "project", label: "Project", children: project },
        ...(rrs ? [{ key: "rrs", label: "RRS Library", children: rrs }] : []),
        { key: "inspector", label: "Inspector", children: inspector },
      ]}
    />
  );
}
