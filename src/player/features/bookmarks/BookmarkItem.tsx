import React from "react";

import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

import { Bookmark } from "../../../types/bookmark";

type BookmarkItemProps = {
  bookmark: Bookmark;
};

export function BookmarkItem({ bookmark }: BookmarkItemProps) {
  function handleOpen() {
    window.player.openUrl({
      url: bookmark.url,
      title: bookmark.title,
      icon: bookmark.icon,
    });
  }

  return (
    <Card sx={{ height: "100%" }}>
      <CardActionArea onClick={handleOpen} sx={{ height: "100%" }}>
        <CardContent
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            minHeight: 120,
          }}
        >
          {bookmark.icon ? (
            <Box
              component="img"
              src={bookmark.icon}
              alt=""
              sx={{ width: 40, height: 40, objectFit: "contain" }}
            />
          ) : (
            <Box
              sx={{
                width: 40,
                height: 40,
                bgcolor: "action.hover",
                borderRadius: 1,
              }}
            />
          )}
          <Typography variant="body1" align="center" noWrap sx={{ width: "100%" }}>
            {bookmark.title}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
