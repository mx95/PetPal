import React from 'react';

export default function DiscoverFeedSkeleton({ count = 2 }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="pp-dFeedCard pp-dFeedCard--skeleton" aria-hidden>
          <div className="pp-dSkel pp-dSkel--row" />
          <div className="pp-dSkel pp-dSkel--banner" />
          <div className="pp-dSkel pp-dSkel--line" />
          <div className="pp-dSkel pp-dSkel--line pp-dSkel--short" />
        </div>
      ))}
    </>
  );
}
