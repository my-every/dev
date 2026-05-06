const LatestUpdatesPanel = () => {
    const [query, setQuery] = React.useState("");
  
    const filterProjects = React.useCallback(
      (projects: Booking[]) => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return projects;
        return projects.filter((booking) =>
          [
            booking.guestName,
            booking.roomType,
            booking.roomNumber,
            booking.source,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        );
      },
      [query],
    );
  
    const filteredArrivals = React.useMemo(
      () => filterProjects(ARRIVALS),
      [filterProjects],
    );
    const filteredInHouse = React.useMemo(
      () => filterProjects(IN_HOUSE),
      [filterProjects],
    );
    const filteredDepartures = React.useMemo(
      () => filterProjects(DEPARTURES),
      [filterProjects],
    );
    const groupedProjects = React.useMemo(
      () => [
        {
          key: "arrivals",
          label: "Arrivals",
          icon: DoorOpen,
          count: filteredArrivals.length,
          projects: filteredArrivals,
        },
        {
          key: "in-house",
          label: "In-House",
          icon: BedDouble,
          count: filteredInHouse.length,
          projects: filteredInHouse,
        },
        {
          key: "departures",
          label: "Departures",
          icon: KeyRound,
          count: filteredDepartures.length,
          projects: filteredDepartures,
        },
      ],
      [filteredArrivals, filteredInHouse, filteredDepartures],
    );
  
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-pretty sm:text-base">
            Latest Updates
          </h2>
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
            Last week
          </Button>
        </div>
  
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-0">
          <div className="mt-3 flex items-center gap-2 rounded-md border bg-background px-2.5 py-2">
            <Search
              className="size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search guest, room, or source"
              className="h-4 w-full border-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              aria-label="Search projects"
            />
          </div>
  
          <div className="mt-3 min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-5 pr-1">
                {groupedProjects.map((group) => (
                  <section key={group.key} className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-md bg-muted text-foreground">
                          <group.icon className="size-3.5" aria-hidden="true" />
                        </span>
                        <span className="text-[11px] font-semibold tracking-[0.08em] text-foreground/90 uppercase">
                          {group.label}
                        </span>
                      </div>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground tabular-nums">
                        {group.count}
                      </span>
                    </div>
                    <BookingList projects={group.projects} />
                  </section>
                ))}
                {groupedProjects.every(
                  (group) => group.projects.length === 0,
                ) && (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                    No projects found for this search.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    );
  };
  